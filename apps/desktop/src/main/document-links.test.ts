import { access, realpath, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../localization';
import { describeDocumentLink, openDocumentLink } from './document-links';

vi.mock('node:fs/promises', () => ({ access: vi.fn(), realpath: vi.fn(), stat: vi.fn() }));
const sourcePath = resolve('fixtures/报告/README.md');
const dependencies = {
  knownPaths: new Set([sourcePath]),
  openPath: vi.fn<(...args: [string]) => Promise<string>>(),
  openExternal: vi.fn<(...args: [string]) => Promise<void>>(),
  readDocument: vi.fn(),
  hasDefaultApplication: vi.fn<(...args: [string]) => Promise<boolean>>(),
  translate: createTranslator('zh-CN'),
};
const fileInfo = { isFile: () => true, isDirectory: () => false, mode: 0o644 };
const folderInfo = { isFile: () => false, isDirectory: () => true, mode: 0o755 };
const open = (href: string, parentOnly = false) =>
  openDocumentLink({ sourcePath, href }, dependencies, parentOnly);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(realpath).mockImplementation(async (path) => String(path));
  vi.mocked(stat).mockResolvedValue(fileInfo as Awaited<ReturnType<typeof stat>>);
  vi.mocked(access).mockResolvedValue(undefined);
  dependencies.openPath.mockResolvedValue('');
  dependencies.openExternal.mockResolvedValue(undefined);
  dependencies.hasDefaultApplication.mockResolvedValue(true);
});

describe('source-relative local document opening', () => {
  it('describes even missing local targets without filesystem or association queries', () => {
    expect(
      describeDocumentLink(
        { sourcePath, href: '../不存在/中文%20文件.sql?q=1#L2' },
        dependencies.knownPaths,
      ),
    ).toBe(resolve(dirname(sourcePath), '../不存在/中文 文件.sql'));
    expect(
      describeDocumentLink(
        { sourcePath: resolve('unknown.md'), href: 'file.sql' },
        dependencies.knownPaths,
      ),
    ).toBeNull();
    expect(
      describeDocumentLink({ sourcePath, href: 'file:///tmp/file.sql' }, dependencies.knownPaths),
    ).toBeNull();
    expect(realpath).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
    expect(access).not.toHaveBeenCalled();
    expect(dependencies.hasDefaultApplication).not.toHaveBeenCalled();
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });
  it.each([
    ['query建表.hql', 'query建表.hql'],
    ['目录/sub/脚本%20query.SQL?q=1#L20', '目录/sub/脚本 query.SQL'],
    ['../query%25.sql', '../query%.sql'],
    ['percent%2520.sql', 'percent%20.sql'],
  ])('opens the filesystem path relative to the source: %s', async (href, relative) => {
    expect(await open(href)).toEqual({ status: 'opened' });
    const target = resolve(dirname(sourcePath), relative);
    expect(dependencies.openPath).toHaveBeenCalledWith(target);
    expect(dependencies.hasDefaultApplication).toHaveBeenCalledWith(target);
    expect(dependencies.openExternal).not.toHaveBeenCalled();
    expect([...dependencies.knownPaths]).toEqual([sourcePath]);
  });

  it('returns Markdown through the existing reader instead of an OS application', async () => {
    const target = resolve(dirname(sourcePath), '另一份.markdown');
    const document = { path: target, name: '另一份.markdown', source: '# Another' };
    dependencies.readDocument.mockResolvedValue({ status: 'available', document });
    expect(await open('另一份.markdown')).toEqual({ status: 'document', document });
    expect(dependencies.readDocument).toHaveBeenCalledWith(target);
    expect(dependencies.hasDefaultApplication).not.toHaveBeenCalled();
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { sourcePath: '/unknown.md', href: 'query.sql' },
    { sourcePath, href: 'file:///tmp/file.sql' },
  ])('rejects untrusted source IDs and unsafe addresses before accessing disk', async (request) => {
    expect(await openDocumentLink(request, dependencies)).toMatchObject({
      status: 'failed',
      canOpenParent: false,
    });
    expect(realpath).not.toHaveBeenCalled();
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });

  it.each([
    'run.exe',
    'run.sh',
    'run.cmd',
    'run.bat',
    'run.ps1',
    'run.js',
    'run.app',
    'run.lnk',
    'run.url',
    'run.docm',
    'run.desktop',
  ])('never launches executables, scripts or shortcuts: %s', async (href) => {
    expect(await open(href)).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('不支持'),
    });
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });

  it('rejects symlinks to executable targets and directories', async () => {
    vi.mocked(realpath).mockResolvedValue(resolve('run.exe'));
    expect(await open('safe.txt')).toMatchObject({ status: 'failed' });
    vi.mocked(realpath).mockImplementation(async (path) => String(path));
    vi.mocked(stat).mockResolvedValue(folderInfo as Awaited<ReturnType<typeof stat>>);
    expect(await open('directory.sql')).toMatchObject({ status: 'failed' });
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === 'win32')(
    'rejects executable permissions even on a text extension',
    async () => {
      vi.mocked(stat).mockResolvedValue({ ...fileInfo, mode: 0o755 } as Awaited<
        ReturnType<typeof stat>
      >);
      expect(await open('run.txt')).toMatchObject({ status: 'failed' });
      expect(dependencies.openPath).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['ENOENT', '文件可能已被移动、重命名或删除。'],
    ['ENOTDIR', '文件可能已被移动、重命名或删除。'],
    ['EACCES', '没有权限访问该文件'],
    ['EPERM', '没有权限访问该文件'],
  ])('reports filesystem failure %s and offers an accessible parent', async (code, message) => {
    vi.mocked(realpath).mockRejectedValue(Object.assign(new Error(), { code }));
    vi.mocked(stat).mockResolvedValue(folderInfo as Awaited<ReturnType<typeof stat>>);
    expect(await open('query.sql')).toMatchObject({
      status: 'failed',
      name: 'query.sql',
      message: expect.stringContaining(message),
      canOpenParent: true,
    });
    expect(dependencies.openPath).not.toHaveBeenCalled();
  });

  it('does not offer an inaccessible or missing parent, and rechecks on action', async () => {
    vi.mocked(realpath).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    vi.mocked(stat).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
    expect(await open('missing/query.sql')).toMatchObject({
      status: 'failed',
      canOpenParent: false,
    });
    expect(await open('missing/query.sql', true)).toMatchObject({
      status: 'failed',
      canOpenParent: false,
    });
    expect(dependencies.openPath).not.toHaveBeenCalled();
    vi.mocked(stat).mockResolvedValue(folderInfo as Awaited<ReturnType<typeof stat>>);
    vi.mocked(realpath).mockImplementation(async (path) => String(path));
    expect(await open('query.sql', true)).toEqual({ status: 'opened' });
    expect(dependencies.openPath).toHaveBeenCalledWith(dirname(sourcePath));
  });

  it('distinguishes no default application from a system open failure', async () => {
    dependencies.hasDefaultApplication.mockResolvedValue(false);
    expect(await open('query.sql')).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('没有可打开'),
    });
    expect(dependencies.openPath).not.toHaveBeenCalled();
    dependencies.hasDefaultApplication.mockResolvedValue(true);
    dependencies.openPath.mockResolvedValue('Failed to open path');
    expect(await open('query.sql')).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('系统未能打开'),
    });
  });

  it('keeps HTTP(S) external and contains browser failures', async () => {
    expect(await open('https://example.com/report')).toEqual({ status: 'opened' });
    expect(dependencies.openExternal).toHaveBeenCalledWith('https://example.com/report');
    expect(realpath).not.toHaveBeenCalled();
    dependencies.openExternal.mockRejectedValue(new Error());
    expect(await open('https://example.com/report')).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('默认浏览器'),
    });
  });

  it('opens mail composition links and reports a missing mail handler', async () => {
    const url = 'mailto:reader@example.com?subject=Hello';
    expect(await open(url)).toEqual({ status: 'opened' });
    expect(dependencies.openExternal).toHaveBeenCalledWith(url);
    expect(realpath).not.toHaveBeenCalled();
    dependencies.openExternal.mockRejectedValue(new Error());
    expect(await open(url)).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('默认邮件应用'),
    });
  });
});
