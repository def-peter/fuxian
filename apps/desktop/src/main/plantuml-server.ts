import { normalizePlantUmlServerUrl } from '@fuxian/shared-types';
import plantUmlEncoder from 'plantuml-encoder';
import { createTranslator, type Translator } from '../localization';

const maximumPlantUmlSourceLength = 500_000;
const maximumPlantUmlSvgBytes = 5 * 1024 * 1024;
const plantUmlRetryDelays = [250, 750] as const;
const validationSource = '@startuml\nAlice -> Bob: Fuxian\n@enduml';

const retryablePlantUmlStatuses = new Set([408, 425, 429]);

const isRetryablePlantUmlStatus = (status: number): boolean =>
  retryablePlantUmlStatuses.has(status) || status >= 500;

const createAbortError = (): DOMException =>
  new DOMException('PlantUML 渲染请求已取消。', 'AbortError');

const waitForRetry = (delay: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    const abort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(createAbortError());
    };
    signal.addEventListener('abort', abort, { once: true });
  });
};

export const createPlantUmlSvgUrl = (
  serverUrl: string,
  source: string,
  t: Translator = createTranslator('zh-CN'),
): string => {
  const normalizedServerUrl = normalizePlantUmlServerUrl(serverUrl);
  if (!normalizedServerUrl)
    throw new TypeError(t('请输入有效的 HTTP 或 HTTPS PlantUML Server 地址。'));
  if (!source || source.length > maximumPlantUmlSourceLength) {
    throw new TypeError(t('PlantUML 源码为空或超过 500,000 个字符。'));
  }
  return `${normalizedServerUrl}/svg/${plantUmlEncoder.encode(source)}`;
};

const readLimitedText = async (response: Response, t: Translator): Promise<string> => {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumPlantUmlSvgBytes) {
    throw new Error(t('PlantUML Server 返回的 SVG 超过 5 MB。'));
  }
  if (!response.body) throw new Error(t('PlantUML Server 没有返回内容。'));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumPlantUmlSvgBytes) {
        throw new Error(t('PlantUML Server 返回的 SVG 超过 5 MB。'));
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
};

const isSvgDocument = (source: string): boolean =>
  /^(?:\s*<\?xml[\s\S]*?\?>)?(?:\s*<!doctype[\s\S]*?>)?\s*<svg(?:\s|>)/i.test(
    source.replace(/^\uFEFF/, ''),
  );

export const fetchPlantUmlSvg = async (
  serverUrl: string,
  source: string,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
  t: Translator = createTranslator('zh-CN'),
  retryDelays: readonly number[] = plantUmlRetryDelays,
): Promise<string> => {
  const url = createPlantUmlSvgUrl(serverUrl, source, t);
  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      response = await fetchImplementation(url, {
        headers: { Accept: 'image/svg+xml' },
        redirect: 'error',
        signal,
      });
      if (!isRetryablePlantUmlStatus(response.status) || attempt === retryDelays.length) break;
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      lastError = error;
      if (attempt === retryDelays.length) {
        throw new Error(t('PlantUML Server 暂时无法连接，请检查网络后重试。'), { cause: error });
      }
    }

    await waitForRetry(retryDelays[attempt] ?? 0, signal);
  }

  if (!response) {
    throw new Error(t('PlantUML Server 暂时无法连接，请检查网络后重试。'), { cause: lastError });
  }
  if (!response.ok) {
    throw new Error(
      isRetryablePlantUmlStatus(response.status)
        ? t('PlantUML Server 暂时不可用（HTTP {status}），请稍后重试。', {
            status: response.status,
          })
        : t('PlantUML Server 拒绝了请求（HTTP {status}），请检查图表语法或服务器地址。', {
            status: response.status,
          }),
    );
  }

  const svg = await readLimitedText(response, t);
  if (!isSvgDocument(svg)) throw new Error(t('PlantUML Server 没有返回有效的 SVG。'));
  return svg;
};

export const validatePlantUmlServer = async (
  serverUrl: string,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
  t: Translator = createTranslator('zh-CN'),
): Promise<string> => {
  const normalizedServerUrl = normalizePlantUmlServerUrl(serverUrl);
  if (!normalizedServerUrl)
    throw new TypeError(t('请输入有效的 HTTP 或 HTTPS PlantUML Server 地址。'));
  await fetchPlantUmlSvg(normalizedServerUrl, validationSource, signal, fetchImplementation, t);
  return normalizedServerUrl;
};
