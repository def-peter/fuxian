export const maximumInfographicSourceBytes = 512 * 1024;
export const maximumInfographicSvgBytes = 5 * 1024 * 1024;

const maximumDataDepth = 32;
const maximumDataItems = 2_000;
const maximumDataProperties = 20_000;
const maximumTextLength = 20_000;
const forbiddenDataKeys = new Set(['attributes']);
const externalResourcePattern = /(?:\b(?:data|file|https?|javascript):|ref:(?:remote|svg))/iu;
const supportedResourceSearchPattern = /^(?:(?:lucide|mdi)\/)?[\p{L}\p{N}][\p{L}\p{N} _/-]{0,95}$/u;

interface ValidationState {
  items: number;
  properties: number;
}

export const invalidInfographicSource = (message: string): TypeError =>
  new TypeError(`Infographic 源码无效：${message}`);

export const assertInfographicSourceSize = (source: string): void => {
  if (new TextEncoder().encode(source).byteLength > maximumInfographicSourceBytes) {
    throw invalidInfographicSource(`源码不能超过 ${maximumInfographicSourceBytes / 1024} KB。`);
  }
};

const validateText = (value: string): void => {
  if (value.length > maximumTextLength) {
    throw invalidInfographicSource(`单段文字不能超过 ${maximumTextLength} 个字符。`);
  }
  if (externalResourcePattern.test(value)) {
    throw invalidInfographicSource('不允许外部 URL、Data URI 或本地文件资源。');
  }
};

const validateValue = (
  value: unknown,
  state: ValidationState,
  depth: number,
  key?: string,
): void => {
  if (depth > maximumDataDepth) throw invalidInfographicSource('数据嵌套层级过深。');
  if ((key === 'icon' || key === 'illus') && typeof value !== 'string') {
    throw invalidInfographicSource('图标和插图只支持简短关键词或本地 lucide、mdi 名称。');
  }
  if (typeof value === 'string') {
    validateText(value);
    if ((key === 'icon' || key === 'illus') && !supportedResourceSearchPattern.test(value)) {
      throw invalidInfographicSource('图标和插图只支持简短关键词或本地 lucide、mdi 名称。');
    }
    return;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    state.items += value.length;
    if (state.items > maximumDataItems) {
      throw invalidInfographicSource(`数据项不能超过 ${maximumDataItems} 个。`);
    }
    for (const item of value) validateValue(item, state, depth + 1);
    return;
  }
  if (typeof value !== 'object') throw invalidInfographicSource('数据包含不支持的值。');

  const entries = Object.entries(value);
  state.properties += entries.length;
  if (state.properties > maximumDataProperties) {
    throw invalidInfographicSource(`数据字段不能超过 ${maximumDataProperties} 个。`);
  }
  for (const [childKey, child] of entries) {
    if (forbiddenDataKeys.has(childKey)) {
      throw invalidInfographicSource(`首版不支持 ${childKey} 资源或任意 SVG 属性。`);
    }
    validateValue(child, state, depth + 1, childKey);
  }
};

export const validateInfographicData = (data: unknown): void => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw invalidInfographicSource('必须包含 data 数据块。');
  }
  validateValue(data, { items: 0, properties: 0 }, 0);
};

export const collectInfographicIllustrationNames = (data: unknown): string[] => {
  const illustrations = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'illus' && typeof child === 'string') illustrations.add(child);
      visit(child);
    }
  };
  visit(data);
  return [...illustrations];
};

const safeColorPattern = /^#[0-9a-f]{3,8}$/iu;

export const validateInfographicThemeConfig = (themeConfig: unknown): void => {
  if (themeConfig === undefined) return;
  if (!themeConfig || typeof themeConfig !== 'object' || Array.isArray(themeConfig)) {
    throw invalidInfographicSource('主题配置必须是对象。');
  }
  for (const [key, value] of Object.entries(themeConfig)) {
    if (key === 'colorBg' || key === 'colorPrimary') {
      if (typeof value !== 'string' || !safeColorPattern.test(value)) {
        throw invalidInfographicSource(`${key} 只接受十六进制颜色。`);
      }
      continue;
    }
    if (
      key === 'palette' &&
      Array.isArray(value) &&
      value.length <= 12 &&
      value.every((color) => typeof color === 'string' && safeColorPattern.test(color))
    ) {
      continue;
    }
    throw invalidInfographicSource(`首版不支持 theme.${key} 配置。`);
  }
};

const animatedInfographicTemplates = new Set([
  'relation-dagre-flow-lr-animated-badge-card',
  'relation-dagre-flow-lr-animated-capsule',
  'relation-dagre-flow-lr-animated-compact-card',
  'relation-dagre-flow-lr-animated-simple-circle-node',
  'relation-dagre-flow-tb-animated-badge-card',
  'relation-dagre-flow-tb-animated-capsule',
  'relation-dagre-flow-tb-animated-compact-card',
  'relation-dagre-flow-tb-animated-simple-circle-node',
  ...['compact', 'default', 'wide'].flatMap((spacing) =>
    ['badge-card', 'capsule-item', 'compact-card', 'rounded-rect-node'].map(
      (item) => `sequence-interaction-${spacing}-animated-${item}`,
    ),
  ),
]);

export type UnsupportedInfographicTemplateCapability = 'animation';

export const unsupportedInfographicTemplateCapability = (
  template: string,
): UnsupportedInfographicTemplateCapability | undefined => {
  if (animatedInfographicTemplates.has(template)) return 'animation';
  return undefined;
};

export const isSupportedInfographicTemplate = (template: string): boolean =>
  unsupportedInfographicTemplateCapability(template) === undefined;
