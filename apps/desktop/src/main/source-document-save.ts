import { randomUUID } from 'node:crypto';
import { chmod, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { createTranslator, type Translator } from '../localization';

const supportedExtensions = new Set(['.md', '.markdown']);

export type SourceDocumentWriteResult =
  | { currentSource: string; status: 'conflict' }
  | { path: string; status: 'saved' }
  | { message: string; status: 'failed' };

export const isMarkdownDocumentPath = (path: string): boolean =>
  supportedExtensions.has(extname(path).toLowerCase());

const replaceFileAtomically = async (
  path: string,
  source: string,
  mode?: number,
): Promise<void> => {
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, source, { encoding: 'utf8', ...(mode ? { mode } : {}) });
    if (mode) await chmod(temporaryPath, mode);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};

export const saveExistingSourceDocument = async (
  path: string,
  expectedSource: string,
  source: string,
  t: Translator = createTranslator('zh-CN'),
): Promise<SourceDocumentWriteResult> => {
  if (!isMarkdownDocumentPath(path)) {
    return { message: t('只能保存 Markdown 文档。'), status: 'failed' };
  }
  try {
    const canonicalPath = await realpath(path);
    if (canonicalPath !== path) {
      return { message: t('源文档路径已发生变化，请重新打开文档。'), status: 'failed' };
    }
    const currentSource = await readFile(canonicalPath, 'utf8');
    if (currentSource !== expectedSource) return { currentSource, status: 'conflict' };
    const file = await stat(canonicalPath);
    await replaceFileAtomically(canonicalPath, source, file.mode);
    return { path: canonicalPath, status: 'saved' };
  } catch {
    return {
      message: t('无法保存“{name}”。请检查文件权限后重试。', { name: basename(path) }),
      status: 'failed',
    };
  }
};

export const saveSourceDocumentCopy = async (
  selectedPath: string,
  source: string,
  t: Translator = createTranslator('zh-CN'),
): Promise<SourceDocumentWriteResult> => {
  if (!isMarkdownDocumentPath(selectedPath)) {
    return { message: t('文件名必须使用 .md 或 .markdown 扩展名。'), status: 'failed' };
  }
  try {
    const existingPath = await realpath(selectedPath).catch(() => undefined);
    const destinationPath = existingPath ?? selectedPath;
    const mode = existingPath ? (await stat(existingPath)).mode : undefined;
    await replaceFileAtomically(destinationPath, source, mode);
    return { path: await realpath(destinationPath), status: 'saved' };
  } catch {
    return {
      message: t('无法将文档保存到“{name}”。请检查目标位置后重试。', {
        name: basename(selectedPath),
      }),
      status: 'failed',
    };
  }
};
