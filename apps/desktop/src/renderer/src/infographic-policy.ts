export const maximumInfographicSourceBytes = 512 * 1024;
export const maximumInfographicSvgBytes = 5 * 1024 * 1024;

const maximumDataDepth = 32;
const maximumDataItems = 2_000;
const maximumDataProperties = 20_000;
const maximumTextLength = 20_000;
const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);

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
};

const validateValue = (value: unknown, state: ValidationState, depth: number): void => {
  if (depth > maximumDataDepth) throw invalidInfographicSource('数据嵌套层级过深。');
  if (typeof value === 'string') {
    validateText(value);
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
    if (forbiddenObjectKeys.has(childKey)) {
      throw invalidInfographicSource(`对象字段 ${childKey} 不安全。`);
    }
    validateValue(child, state, depth + 1);
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

export const validateInfographicThemeConfig = (themeConfig: unknown): void => {
  if (themeConfig === undefined) return;
  if (!themeConfig || typeof themeConfig !== 'object' || Array.isArray(themeConfig)) {
    throw invalidInfographicSource('主题配置必须是对象。');
  }
  validateValue(themeConfig, { items: 0, properties: 0 }, 0);
};

export const validateInfographicDesign = (design: unknown): void => {
  if (design === undefined) return;
  if (!design || typeof design !== 'object' || Array.isArray(design)) {
    throw invalidInfographicSource('设计配置必须是对象。');
  }
  validateValue(design, { items: 0, properties: 0 }, 0);
};

export const validateInfographicTemplate = (
  template: unknown,
  design: unknown,
  officialTemplates: readonly string[],
): void => {
  if (
    template !== undefined &&
    (typeof template !== 'string' || !officialTemplates.includes(template))
  ) {
    throw invalidInfographicSource('必须使用名称完全匹配的官方内置模板。');
  }
  if (template === undefined && design === undefined) {
    throw invalidInfographicSource('必须使用官方内置模板或提供 design 配置。');
  }
};
