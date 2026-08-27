import { normalizePlantUmlServerUrl } from '@fuxian/shared-types';
import plantUmlEncoder from 'plantuml-encoder';

const maximumPlantUmlSourceLength = 500_000;
const maximumPlantUmlSvgBytes = 5 * 1024 * 1024;
const validationSource = '@startuml\nAlice -> Bob: Fuxian\n@enduml';

export const createPlantUmlSvgUrl = (serverUrl: string, source: string): string => {
  const normalizedServerUrl = normalizePlantUmlServerUrl(serverUrl);
  if (!normalizedServerUrl)
    throw new TypeError('请输入有效的 HTTP 或 HTTPS PlantUML Server 地址。');
  if (!source || source.length > maximumPlantUmlSourceLength) {
    throw new TypeError('PlantUML 源码为空或超过 500,000 个字符。');
  }
  return `${normalizedServerUrl}/svg/${plantUmlEncoder.encode(source)}`;
};

const readLimitedText = async (response: Response): Promise<string> => {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumPlantUmlSvgBytes) {
    throw new Error('PlantUML Server 返回的 SVG 超过 5 MB。');
  }
  if (!response.body) throw new Error('PlantUML Server 没有返回内容。');

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
        throw new Error('PlantUML Server 返回的 SVG 超过 5 MB。');
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
): Promise<string> => {
  const response = await fetchImplementation(createPlantUmlSvgUrl(serverUrl, source), {
    headers: { Accept: 'image/svg+xml' },
    redirect: 'error',
    signal,
  });
  if (!response.ok) {
    throw new Error(`PlantUML Server 返回 HTTP ${response.status}。`);
  }

  const svg = await readLimitedText(response);
  if (!isSvgDocument(svg)) throw new Error('PlantUML Server 没有返回有效的 SVG。');
  return svg;
};

export const validatePlantUmlServer = async (
  serverUrl: string,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> => {
  const normalizedServerUrl = normalizePlantUmlServerUrl(serverUrl);
  if (!normalizedServerUrl)
    throw new TypeError('请输入有效的 HTTP 或 HTTPS PlantUML Server 地址。');
  await fetchPlantUmlSvg(normalizedServerUrl, validationSource, signal, fetchImplementation);
  return normalizedServerUrl;
};
