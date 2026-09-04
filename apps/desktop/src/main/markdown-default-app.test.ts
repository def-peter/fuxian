import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildWindowsAssociationQueryScript,
  classifyMarkdownAssociations,
  createMarkdownDefaultAppService,
  parseWindowsAssociationQuery,
} from './markdown-default-app';

const withTemporaryDirectory = async <Result>(
  operation: (directory: string) => Promise<Result>,
): Promise<Result> => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-default-app-test-'));
  try {
    return await operation(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

describe('Markdown default application service', () => {
  it('distinguishes full, partial, and missing associations', () => {
    expect(classifyMarkdownAssociations(true, true)).toBe('default');
    expect(classifyMarkdownAssociations(true, false)).toBe('partial');
    expect(classifyMarkdownAssociations(false, true)).toBe('partial');
    expect(classifyMarkdownAssociations(false, false)).toBe('not-default');
  });

  it('queries the effective Windows Shell association through the supported API', () => {
    const script = buildWindowsAssociationQueryScript();

    expect(script).toContain('AssocQueryString');
    expect(script).toContain('ASSOCSTR_PROGID');
    expect(script).not.toContain('UserChoice');
    expect(script).not.toContain('HKEY_CLASSES_ROOT');
  });

  it('does not mistake installer registration for a Notepad user choice', () => {
    expect(
      parseWindowsAssociationQuery(
        JSON.stringify({ md: 'Applications\\notepad.exe', markdown: 'Applications\\notepad.exe' }),
      ),
    ).toEqual({ md: false, markdown: false });
    expect(
      parseWindowsAssociationQuery(
        JSON.stringify({ md: 'Fuxian.Markdown', markdown: 'Applications\\notepad.exe' }),
      ),
    ).toEqual({ md: true, markdown: false });
  });

  it('rejects incomplete Shell association results instead of falling back', () => {
    expect(() => parseWindowsAssociationQuery(JSON.stringify({ md: 'Fuxian.Markdown' }))).toThrow(
      'reliable association',
    );
  });

  it('keeps development mode unavailable without opening system settings', async () => {
    const openExternal = vi.fn();
    const service = createMarkdownDefaultAppService({
      executablePath: '/tmp/Fuxian',
      isPackaged: false,
      openExternal,
      platform: 'win32',
      revealFile: vi.fn(),
      showMacGuidance: vi.fn(),
      temporaryDirectory: '/tmp',
    });

    await expect(service.getStatus()).resolves.toMatchObject({
      markdown: null,
      md: null,
      state: 'unavailable',
    });
    await expect(service.openSettings()).resolves.toMatchObject({ status: 'unavailable' });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('supports deterministic E2E status adapters without touching the host', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createMarkdownDefaultAppService({
      executablePath: '/tmp/Fuxian',
      isPackaged: false,
      openExternal,
      platform: 'win32',
      revealFile: vi.fn(),
      showMacGuidance: vi.fn(),
      temporaryDirectory: '/tmp',
      testState: 'partial',
    });

    await expect(service.getStatus()).resolves.toMatchObject({
      markdown: false,
      md: true,
      state: 'partial',
    });
    await expect(service.openSettings()).resolves.toMatchObject({ status: 'opened' });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('opens Windows settings only after an explicit packaged-app request', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createMarkdownDefaultAppService({
      executablePath: 'C:\\Program Files\\Fuxian\\Fuxian.exe',
      isPackaged: true,
      openExternal,
      platform: 'win32',
      revealFile: vi.fn(),
      showMacGuidance: vi.fn(),
      temporaryDirectory: 'C:\\Temp',
    });

    await expect(service.openSettings()).resolves.toMatchObject({ status: 'opened' });
    expect(openExternal).toHaveBeenCalledWith('ms-settings:defaultapps?registeredAppUser=Fuxian');
  });

  it('gives actionable fallback guidance for Windows versions without a deep link', async () => {
    const service = createMarkdownDefaultAppService({
      executablePath: 'C:\\Program Files\\Fuxian\\Fuxian.exe',
      isPackaged: true,
      openExternal: vi.fn().mockResolvedValue(undefined),
      platform: 'win32',
      revealFile: vi.fn(),
      showMacGuidance: vi.fn(),
      temporaryDirectory: 'C:\\Temp',
    });

    await expect(service.openSettings()).resolves.toMatchObject({
      message: expect.stringMatching(/搜索 Fuxian.*\.md.*\.markdown/u),
      status: 'opened',
    });
  });

  it('sets both Markdown associations directly on macOS after an explicit request', async () => {
    await withTemporaryDirectory(async (temporaryDirectory) => {
      const revealFile = vi.fn();
      const setMacDefaultApplications = vi.fn().mockImplementation(async (_appPath, paths) => {
        expect(paths.map((path: string) => path.split('.').at(-1))).toEqual(['md', 'markdown']);
      });
      const showMacGuidance = vi.fn();
      const service = createMarkdownDefaultAppService({
        executablePath: '/Applications/浮现.app/Contents/MacOS/浮现',
        isPackaged: true,
        openExternal: vi.fn(),
        platform: 'darwin',
        revealFile,
        setMacDefaultApplications,
        showMacGuidance,
        temporaryDirectory,
      });

      await expect(service.openSettings()).resolves.toEqual({
        message: '已将浮现设为 .md 与 .markdown 的默认应用。',
        status: 'opened',
      });
      expect(setMacDefaultApplications).toHaveBeenCalledWith(
        '/Applications/浮现.app',
        expect.arrayContaining([
          expect.stringMatching(/\.md$/u),
          expect.stringMatching(/\.markdown$/u),
        ]),
      );
      expect(revealFile).not.toHaveBeenCalled();
      expect(showMacGuidance).not.toHaveBeenCalled();
    });
  });

  it('falls back to Finder guidance when the native macOS request fails', async () => {
    await withTemporaryDirectory(async (temporaryDirectory) => {
      const revealFile = vi.fn();
      const setMacDefaultApplications = vi.fn().mockRejectedValue(new Error('denied'));
      const showMacGuidance = vi.fn().mockResolvedValue(undefined);
      const service = createMarkdownDefaultAppService({
        executablePath: '/Applications/浮现.app/Contents/MacOS/浮现',
        isPackaged: true,
        openExternal: vi.fn(),
        platform: 'darwin',
        revealFile,
        setMacDefaultApplications,
        showMacGuidance,
        temporaryDirectory,
      });

      await expect(service.openSettings()).resolves.toEqual({
        message: '系统未能直接完成设置，已在访达中显示示例文档，可通过“显示简介”继续设置。',
        status: 'opened',
      });
      expect(revealFile).toHaveBeenCalledWith(join(temporaryDirectory, '浮现默认应用设置.md'));
      expect(showMacGuidance).toHaveBeenCalledOnce();
    });
  });
});
