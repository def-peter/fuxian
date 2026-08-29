import { DOMParser } from 'linkedom/worker';

const trustedSearchOrigin = 'https://www.weavefox.cn';
const trustedSearchPath = '/api/v1/infographic/icon';
const trustedAssetOrigin = 'https://mdn.alipayobjects.com';
const trustedAssetPathPrefix = '/infographicservice/afts/img/';
const maximumSearchResponseBytes = 256 * 1024;
const maximumSvgResourceBytes = 1024 * 1024;
const resourceTimeoutMilliseconds = 8_000;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface InfographicResourceFetchOptions {
  fetchNetwork: FetchFunction;
  preferOnlineResource(query: string): boolean;
  resolveLocalResource(query: string): Promise<string | undefined>;
}

const blockedResponse = (message: string, status = 403): Response =>
  new Response(message, { status, statusText: 'Blocked' });

const isTrustedSearchUrl = (url: URL): boolean =>
  url.origin === trustedSearchOrigin && url.pathname === trustedSearchPath;

const isTrustedAssetUrl = (url: URL): boolean =>
  url.origin === trustedAssetOrigin &&
  url.pathname.startsWith(trustedAssetPathPrefix) &&
  url.pathname.endsWith('/original') &&
  !url.search &&
  !url.hash;

const isTrustedAssetResource = (value: string): boolean => {
  try {
    return isTrustedAssetUrl(new URL(value));
  } catch {
    return false;
  }
};

const hasOnlyFragmentUrlReferences = (value: string): boolean =>
  [...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/giu)].every((match) =>
    match[2]?.startsWith('#'),
  );

export const sanitizeTrustedInfographicSvgResource = (source: string): string => {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = document.documentElement;
  if (svg?.localName !== 'svg') throw new TypeError('可信资源没有返回有效的 SVG。');
  if (svg.querySelectorAll('*').length > 20_000) {
    throw new TypeError('可信 SVG 资源包含过多元素。');
  }

  for (const element of svg.querySelectorAll(
    'script, foreignObject, iframe, object, embed, image, audio, video, source, animate, animateMotion, animateTransform, set',
  )) {
    element.remove();
  }
  for (const anchor of svg.querySelectorAll('a')) anchor.replaceWith(...anchor.childNodes);
  for (const style of svg.querySelectorAll('style')) {
    if (/@import\b|url\s*\(/iu.test(style.textContent ?? '')) style.remove();
  }
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        name === 'src' ||
        name === 'formaction' ||
        name === 'xml:base' ||
        ((name === 'href' || name.endsWith(':href')) && !value.startsWith('#')) ||
        !hasOnlyFragmentUrlReferences(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return svg.outerHTML;
};

const readBoundedBody = async (response: Response, maximumBytes: number): Promise<Uint8Array> => {
  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new TypeError('可信在线资源超过大小限制。');
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > maximumBytes) throw new TypeError('可信在线资源超过大小限制。');
  return body;
};

const fetchTrusted = async (
  fetchNetwork: FetchFunction,
  url: URL,
  accept: string,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resourceTimeoutMilliseconds);
  try {
    return await fetchNetwork(
      new Request(url, {
        credentials: 'omit',
        headers: { accept },
        method: 'GET',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
};

const sanitizeSearchResponse = async (response: Response): Promise<Response> => {
  if (!response.ok || response.status < 200 || response.status >= 300) {
    return blockedResponse('可信资源搜索失败。', 502);
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return blockedResponse('可信资源搜索返回了错误格式。', 502);
  }
  const bytes = await readBoundedBody(response, maximumSearchResponseBytes);
  const result = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (!result || typeof result !== 'object') {
    return blockedResponse('可信资源搜索返回了错误数据。', 502);
  }
  const record = result as { data?: unknown; success?: unknown };
  const data = Array.isArray(record.data)
    ? record.data.filter(
        (value): value is string => typeof value === 'string' && isTrustedAssetResource(value),
      )
    : [];
  if (record.success !== true || data.length === 0) {
    return blockedResponse('可信资源搜索没有返回允许的资源。', 404);
  }
  return new Response(JSON.stringify({ data: data.slice(0, 1), success: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    status: 200,
  });
};

const sanitizeAssetResponse = async (response: Response): Promise<Response> => {
  if (!response.ok || response.status < 200 || response.status >= 300) {
    return blockedResponse('可信 SVG 资源加载失败。', 502);
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('image/svg+xml')) {
    return blockedResponse('可信资源不是 SVG。', 415);
  }
  const bytes = await readBoundedBody(response, maximumSvgResourceBytes);
  const svg = sanitizeTrustedInfographicSvgResource(new TextDecoder().decode(bytes));
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
    status: 200,
  });
};

export const createInfographicResourceFetch =
  ({
    fetchNetwork,
    preferOnlineResource,
    resolveLocalResource,
  }: InfographicResourceFetchOptions): FetchFunction =>
  async (input, init) => {
    const request = new Request(input, init);
    if (request.method !== 'GET') return blockedResponse('Infographic 只允许读取可信资源。');
    const url = new URL(request.url);

    if (isTrustedSearchUrl(url)) {
      const query = url.searchParams.get('text')?.trim() ?? '';
      const explicitLocalResource = /^(?:lucide|mdi)\//iu.test(query);
      const local =
        !preferOnlineResource(query) || explicitLocalResource
          ? await resolveLocalResource(query)
          : undefined;
      if (local) {
        return new Response(JSON.stringify({ data: [local], success: true }), {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 200,
        });
      }
      if (explicitLocalResource) return blockedResponse('找不到指定的本地图标或插图。', 404);
      try {
        return await sanitizeSearchResponse(
          await fetchTrusted(fetchNetwork, url, 'application/json'),
        );
      } catch {
        return blockedResponse('可信资源搜索失败。', 502);
      }
    }

    if (isTrustedAssetUrl(url)) {
      try {
        return await sanitizeAssetResponse(await fetchTrusted(fetchNetwork, url, 'image/svg+xml'));
      } catch {
        return blockedResponse('可信 SVG 资源加载失败。', 502);
      }
    }

    return blockedResponse('Fuxian 已阻止非可信 Infographic 资源。');
  };
