import { describe, expect, it, vi } from 'vitest';
import {
  buildWindowsAssociationQueryScript,
  classifyMarkdownAssociations,
  createMarkdownDefaultAppService,
  parseWindowsAssociationQuery,
} from './markdown-default-app';

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
});
