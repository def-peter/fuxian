import {
  classifyDocumentLink,
  type OpenDocumentLinkResult,
  type ReadSourceDocumentResult,
} from '@fuxian/shared-types';
import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import type { Translator } from '../localization';

const markdownTypes = new Set(['.md', '.markdown']);
// Excludes scripts, executables, installers, shortcuts and macro-enabled formats.
const documentTypes = new Set([
  '.txt',
  '.log',
  '.sql',
  '.hql',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.mp3',
  '.wav',
  '.mp4',
  '.mov',
]);
const supported = (path: string): boolean =>
  markdownTypes.has(extname(path).toLowerCase()) || documentTypes.has(extname(path).toLowerCase());

interface Dependencies {
  knownPaths: ReadonlySet<string>;
  openPath(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  hasDefaultApplication(path: string): Promise<boolean>;
  readDocument(path: string): Promise<ReadSourceDocumentResult>;
  translate: Translator;
}

/** Display-only resolution: deliberately no filesystem or association queries. */
export function describeDocumentLink(
  value: unknown,
  knownPaths: ReadonlySet<string>,
): string | null {
  const request = value as { sourcePath?: unknown; href?: unknown } | null;
  if (
    !request ||
    typeof request.sourcePath !== 'string' ||
    !isAbsolute(request.sourcePath) ||
    !knownPaths.has(request.sourcePath)
  )
    return null;
  const link = classifyDocumentLink(request.href);
  return link.kind === 'local' ? resolve(dirname(request.sourcePath), link.path) : null;
}

export async function openDocumentLink(
  value: unknown,
  dependencies: Dependencies,
  parentOnly = false,
): Promise<OpenDocumentLinkResult> {
  const t = dependencies.translate;
  const request = value as { sourcePath?: unknown; href?: unknown } | null;
  const fail = (name: string, message: string, canOpenParent = false): OpenDocumentLinkResult => ({
    status: 'failed',
    name,
    message,
    canOpenParent,
  });
  if (
    !request ||
    typeof request.sourcePath !== 'string' ||
    !isAbsolute(request.sourcePath) ||
    !dependencies.knownPaths.has(request.sourcePath)
  ) {
    return fail('', t('该文档不属于当前文档会话。'));
  }
  const link = classifyDocumentLink(request.href);
  if (link.kind === 'external' && !parentOnly) {
    try {
      await dependencies.openExternal(link.url);
      return { status: 'opened' };
    } catch {
      return fail(
        link.url,
        t(
          link.url.startsWith('mailto:')
            ? '无法打开邮件链接，请检查默认邮件应用后重试。'
            : '无法打开链接，请检查默认浏览器后重试。',
        ),
      );
    }
  }
  if (link.kind !== 'local') return fail('', t('链接地址无效或使用了不支持的协议。'));
  const target = resolve(dirname(request.sourcePath), link.path);
  const name = basename(target);
  if (!supported(target))
    return fail(name, t('不支持打开此类文件。可执行文件、脚本和快捷方式不能从文档中启动。'));
  const parent = dirname(target);
  const canOpenParent = async (): Promise<boolean> => {
    try {
      if (!(await stat(parent)).isDirectory()) return false;
      await access(parent, constants.R_OK | constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  try {
    if (parentOnly) {
      if (!(await canOpenParent())) return fail(name, t('所在目录不存在或无法访问。'));
      const error = await dependencies.openPath(await realpath(parent));
      return error ? fail(name, t('无法打开所在目录，请重试。')) : { status: 'opened' };
    }
    const canonical = await realpath(target);
    const info = await stat(canonical);
    if (
      !info.isFile() ||
      !supported(canonical) ||
      (process.platform !== 'win32' && (info.mode & 0o111) !== 0)
    ) {
      return fail(name, t('不支持打开此类文件。可执行文件、脚本和快捷方式不能从文档中启动。'));
    }
    await access(canonical, constants.R_OK);
    if (markdownTypes.has(extname(canonical).toLowerCase())) {
      const result = await dependencies.readDocument(canonical);
      return result.status === 'available'
        ? { status: 'document', document: result.document }
        : fail(name, result.message, await canOpenParent());
    }
    if (!(await dependencies.hasDefaultApplication(canonical)))
      return fail(
        name,
        t('没有可打开此类文件的默认应用，请先在系统中设置。'),
        await canOpenParent(),
      );
    const error = await dependencies.openPath(canonical);
    return error
      ? fail(name, t('系统未能打开文件，请检查默认应用后重试。'), await canOpenParent())
      : { status: 'opened' };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    const message =
      code === 'ENOENT' || code === 'ENOTDIR'
        ? t('文件可能已被移动、重命名或删除。')
        : code === 'EACCES' || code === 'EPERM'
          ? t('没有权限访问该文件，请检查文件或所在目录的访问权限。')
          : t('系统未能打开文件，请检查默认应用后重试。');
    return fail(name, message, await canOpenParent());
  }
}
