import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';

export const documentResourceScheme = 'fuxian-resource';

const supportedImageTypes = new Map([
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

interface DocumentResourceScope {
  rootDirectory: string;
}

export type DocumentResourceResolution =
  | { status: 'allowed'; path: string; mediaType: string }
  | { status: 'rejected'; httpStatus: 400 | 403 | 404 | 415; message: string };

const reject = (
  httpStatus: 400 | 403 | 404 | 415,
  message: string,
): DocumentResourceResolution => ({ status: 'rejected', httpStatus, message });

const parseResourceRequest = (
  requestUrl: string,
): { scopeId: string; pathSegments: string[] } | undefined => {
  const match = /^fuxian-resource:\/\/([^/]+)(\/[^?#]*)?(?:[?#].*)?$/i.exec(requestUrl);
  if (!match?.[1]) {
    return undefined;
  }

  const pathSegments: string[] = [];
  for (const rawSegment of (match[2] ?? '/').split('/')) {
    if (!rawSegment) {
      continue;
    }

    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return undefined;
    }

    if (
      segment === '..' ||
      segment.includes('/') ||
      segment.includes('\\') ||
      segment.includes('\0')
    ) {
      return undefined;
    }

    if (segment !== '.') {
      pathSegments.push(segment);
    }
  }

  return { scopeId: match[1].toLowerCase(), pathSegments };
};

const isWithinDirectory = (rootDirectory: string, candidatePath: string): boolean => {
  const relativePath = relative(rootDirectory, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
};

export class DocumentResourceTrustStore {
  readonly #scopes = new Map<string, DocumentResourceScope>();

  async grantSourceDocument(sourcePath: string): Promise<string> {
    const sourceRealPath = await realpath(sourcePath);
    const sourceStats = await stat(sourceRealPath);
    if (!sourceStats.isFile()) {
      throw new TypeError('The source document must be a file.');
    }

    const scopeId = randomUUID();
    this.#scopes.clear();
    this.#scopes.set(scopeId, { rootDirectory: await realpath(dirname(sourceRealPath)) });
    return `${documentResourceScheme}://${scopeId}/`;
  }

  async resolve(requestUrl: string): Promise<DocumentResourceResolution> {
    const request = parseResourceRequest(requestUrl);
    if (!request || request.pathSegments.length === 0) {
      return reject(400, '资源地址无效。');
    }

    const scope = this.#scopes.get(request.scopeId);
    if (!scope) {
      return reject(403, '这份文档没有访问该资源的权限。');
    }

    const extension = extname(request.pathSegments.at(-1) ?? '').toLowerCase();
    const mediaType = supportedImageTypes.get(extension);
    if (!mediaType) {
      return reject(415, '不支持这种图片格式。');
    }

    const candidatePath = resolve(scope.rootDirectory, ...request.pathSegments);
    if (!isWithinDirectory(scope.rootDirectory, candidatePath)) {
      return reject(403, '图片路径超出了文档的授权范围。');
    }

    let resourceRealPath: string;
    try {
      resourceRealPath = await realpath(candidatePath);
    } catch {
      return reject(404, '找不到这张图片。');
    }

    if (!isWithinDirectory(scope.rootDirectory, resourceRealPath)) {
      return reject(403, '图片路径超出了文档的授权范围。');
    }

    const resourceStats = await stat(resourceRealPath);
    if (!resourceStats.isFile()) {
      return reject(404, '找不到这张图片。');
    }

    return { status: 'allowed', path: resourceRealPath, mediaType };
  }
}
