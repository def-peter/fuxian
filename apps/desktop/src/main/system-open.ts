import { extname, isAbsolute, resolve } from 'node:path';

const supportedExtensions = new Set(['.md', '.markdown']);

export const isSupportedSourceDocumentPath = (path: string): boolean =>
  supportedExtensions.has(extname(path).toLowerCase());

export const extractSourceDocumentPaths = (
  argv: readonly string[],
  workingDirectory: string,
): string[] =>
  argv
    .filter((argument) => argument.length > 0 && !argument.startsWith('-'))
    .filter(isSupportedSourceDocumentPath)
    .slice(0, 100)
    .map((path) => (isAbsolute(path) ? path : resolve(workingDirectory, path)));
