import type { TopLevelSpec } from 'vega-lite';

export const maximumVegaLiteSourceBytes = 512 * 1024;
export const maximumVegaLiteSvgBytes = 5 * 1024 * 1024;

const maximumInlineRows = 10_000;
const maximumJsonDepth = 64;
const maximumJsonNodes = 50_000;
const maximumJsonProperties = 200_000;
const maximumDimension = 4_096;
const maximumTransforms = 100;

const allowedTransforms = new Set([
  'aggregate',
  'bin',
  'calculate',
  'filter',
  'joinaggregate',
  'lookup',
  'stack',
  'timeUnit',
  'window',
]);
const knownTransforms = new Set([
  ...allowedTransforms,
  'density',
  'extent',
  'flatten',
  'fold',
  'impute',
  'loess',
  'pivot',
  'quantile',
  'regression',
  'sample',
]);

interface ValidationState {
  inlineRows: number;
  nodes: number;
  properties: number;
  transforms: number;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const invalidVegaLiteSpecification = (message: string): TypeError =>
  new TypeError(`Vega-Lite specification 无效：${message}`);

export const assertVegaLiteSourceSize = (source: string): void => {
  if (new TextEncoder().encode(source).byteLength > maximumVegaLiteSourceBytes) {
    throw invalidVegaLiteSpecification(`源码不能超过 ${maximumVegaLiteSourceBytes / 1024} KB。`);
  }
};

const validateTransforms = (value: unknown, state: ValidationState): void => {
  if (!Array.isArray(value)) throw invalidVegaLiteSpecification('transform 必须是数组。');
  state.transforms += value.length;
  if (state.transforms > maximumTransforms) {
    throw invalidVegaLiteSpecification(`transform 不能超过 ${maximumTransforms} 个。`);
  }
  for (const transform of value) {
    if (!isRecord(transform)) throw invalidVegaLiteSpecification('transform 项必须是对象。');
    const kind = [...knownTransforms].find((candidate) => candidate in transform);
    if (kind && !allowedTransforms.has(kind)) {
      throw invalidVegaLiteSpecification(`首版不支持 ${kind} transform。`);
    }
  }
};

const validateSpecificationValue = (
  value: unknown,
  state: ValidationState,
  depth: number,
  insideInlineData = false,
): void => {
  if (depth > maximumJsonDepth) throw invalidVegaLiteSpecification('JSON 嵌套层级过深。');
  if (value === null || typeof value !== 'object') return;
  state.nodes += 1;
  if (state.nodes > maximumJsonNodes) {
    throw invalidVegaLiteSpecification('JSON 节点数量过多。');
  }

  if (Array.isArray(value)) {
    for (const item of value) validateSpecificationValue(item, state, depth + 1, insideInlineData);
    return;
  }
  if (!isRecord(value)) return;
  state.properties += Object.keys(value).length;
  if (state.properties > maximumJsonProperties) {
    throw invalidVegaLiteSpecification('JSON 字段数量过多。');
  }

  if (!insideInlineData) {
    if ('datasets' in value) {
      throw invalidVegaLiteSpecification('首版不支持命名数据集，只允许 data.values 内联数据。');
    }
    if ('url' in value || 'href' in value) {
      throw invalidVegaLiteSpecification('不允许外部 URL 或链接。');
    }
    if ('params' in value || 'selection' in value) {
      throw invalidVegaLiteSpecification('首版只生成静态图表，不支持交互参数。');
    }
    const mark = value.mark;
    const markType =
      typeof mark === 'string'
        ? mark
        : isRecord(mark) && typeof mark.type === 'string'
          ? mark.type
          : undefined;
    if (markType === 'image') {
      throw invalidVegaLiteSpecification('首版不支持可能加载外部资源的 image mark。');
    }

    for (const dimension of ['width', 'height'] as const) {
      const size = value[dimension];
      if (size !== undefined && typeof size !== 'number') {
        throw invalidVegaLiteSpecification(`${dimension} 首版只接受固定像素数值。`);
      }
      if (
        typeof size === 'number' &&
        (!Number.isFinite(size) || size <= 0 || size > maximumDimension)
      ) {
        throw invalidVegaLiteSpecification(`${dimension} 必须在 1 到 ${maximumDimension} 之间。`);
      }
    }

    if ('transform' in value) validateTransforms(value.transform, state);
    if ('data' in value) {
      if (!isRecord(value.data) || !Array.isArray(value.data.values)) {
        throw invalidVegaLiteSpecification('首版只允许 data.values 数组形式的内联数据。');
      }
      if (Object.keys(value.data).some((key) => key !== 'values')) {
        throw invalidVegaLiteSpecification('data 只能包含 values，不能引用其他数据源。');
      }
      state.inlineRows += value.data.values.length;
      if (state.inlineRows > maximumInlineRows) {
        throw invalidVegaLiteSpecification(`内联数据不能超过 ${maximumInlineRows} 行。`);
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    validateSpecificationValue(child, state, depth + 1, insideInlineData || key === 'values');
  }
};

export const parseVegaLiteSource = (source: string): TopLevelSpec => {
  assertVegaLiteSourceSize(source);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw invalidVegaLiteSpecification('必须使用合法 JSON。');
  }
  if (!isRecord(parsed)) throw invalidVegaLiteSpecification('顶层必须是 JSON 对象。');
  validateSpecificationValue(parsed, { inlineRows: 0, nodes: 0, properties: 0, transforms: 0 }, 0);
  return parsed as unknown as TopLevelSpec;
};
