import { describe, expect, it, vi } from 'vitest';
import {
  classifyMarkdownAssociations,
  createMarkdownDefaultAppService,
  isWindowsMarkdownAssociation,
} from './markdown-default-app';

describe('Markdown default application service', () => {
  it('distinguishes full, partial, and missing associations', () => {
    expect(classifyMarkdownAssociations(true, true)).toBe('default');
    expect(classifyMarkdownAssociations(true, false)).toBe('partial');
    expect(classifyMarkdownAssociations(false, true)).toBe('partial');
    expect(classifyMarkdownAssociations(false, false)).toBe('not-default');
  });

  it('recognizes only the installed Fuxian ProgID and executable', () => {
    const executablePath = 'C:\\Users\\Peter\\AppData\\Local\\Programs\\Fuxian\\Fuxian.exe';

    expect(
      isWindowsMarkdownAssociation(
        {
          command: `"${executablePath}" "%1"`,
          progId: 'Fuxian.Markdown',
        },
        executablePath,
      ),
    ).toBe(true);
    expect(
      isWindowsMarkdownAssociation(
        { command: `"${executablePath}" "%1"`, progId: 'Markdown 文档' },
        executablePath,
      ),
    ).toBe(false);
    expect(
      isWindowsMarkdownAssociation(
        { command: '"C:\\Other\\Reader.exe" "%1"', progId: 'Fuxian.Markdown' },
        executablePath,
      ),
    ).toBe(false);
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
});
