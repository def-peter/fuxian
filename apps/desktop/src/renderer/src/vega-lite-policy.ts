import type { TopLevelSpec } from 'vega-lite';

export const maximumVegaLiteSourceBytes = 512 * 1024;
export const maximumVegaLiteSvgBytes = 5 * 1024 * 1024;
export const maximumVegaLiteDimension = 4_096;

const maximumJsonDepth = 64;
const maximumJsonNodes = 50_000;
const maximumJsonProperties = 200_000;

export interface VegaLiteContainerSize {
  width?: number;
  height?: number;
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

// Only budget the JSON here. Field meanings and allowed syntax belong to the
// bundled official schema, not a recursive blacklist of property names.
export const parseVegaLiteSource = (source: string): TopLevelSpec => {
  assertVegaLiteSourceSize(source);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw invalidVegaLiteSpecification('必须使用合法 JSON。');
  }
  if (!isRecord(parsed)) throw invalidVegaLiteSpecification('顶层必须是 JSON 对象。');
  let nodes = 0;
  let properties = 0;
  const visit = (value: unknown, depth: number): void => {
    if (depth > maximumJsonDepth) throw invalidVegaLiteSpecification('JSON 嵌套层级过深。');
    if (++nodes > maximumJsonNodes) throw invalidVegaLiteSpecification('JSON 节点数量过多。');
    if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1);
    } else if (isRecord(value)) {
      properties += Object.keys(value).length;
      if (properties > maximumJsonProperties) {
        throw invalidVegaLiteSpecification('JSON 字段数量过多。');
      }
      for (const child of Object.values(value)) visit(child, depth + 1);
    }
  };
  visit(parsed, 0);
  return parsed as unknown as TopLevelSpec;
};

// Inspect actual Vega data sources and marks after official compilation. Inline
// rows, dataset names, field names and formatting dictionaries are inert data.
export const validateVegaResources = (specification: unknown): void => {
  let inlineRows = 0;
  const visitScope = (scope: unknown): void => {
    if (!isRecord(scope)) return;
    if (Array.isArray(scope.data)) {
      for (const data of scope.data) {
        if (!isRecord(data)) continue;
        if (data.url !== undefined) {
          throw invalidVegaLiteSpecification('不允许加载外部数据源。');
        }
        if (Array.isArray(data.values)) inlineRows += data.values.length;
      }
    }
    if (Array.isArray(scope.marks)) {
      for (const mark of scope.marks) {
        if (!isRecord(mark)) continue;
        if (mark.type === 'image') {
          throw invalidVegaLiteSpecification('静态 SVG 渲染暂不支持 image mark。');
        }
        if (isRecord(mark.encode)) {
          for (const encoding of Object.values(mark.encode)) {
            if (isRecord(encoding) && encoding.href !== undefined) {
              throw invalidVegaLiteSpecification('不允许图形包含外部链接。');
            }
          }
        }
        visitScope(mark);
      }
    }
  };
  visitScope(specification);
  if (inlineRows > 10_000) {
    throw invalidVegaLiteSpecification('内联数据不能超过 10000 行。');
  }
};

// Diagnose prohibited data requests before compilation too: some otherwise
// incomplete specs fail in the compiler before exposing their resource error.
// Traverse only specification/data-source positions, never user rows or names.
export const assertVegaLiteDataResources = (specification: unknown): void => {
  const checkData = (data: unknown): void => {
    if (isRecord(data) && data.url !== undefined) {
      throw invalidVegaLiteSpecification('不允许加载外部数据源。');
    }
  };
  const visit = (spec: unknown): void => {
    if (!isRecord(spec)) return;
    checkData(spec.data);
    if (Array.isArray(spec.transform)) {
      for (const transform of spec.transform) {
        if (isRecord(transform) && isRecord(transform.from)) checkData(transform.from.data);
      }
    }
    visit(spec.spec);
    for (const key of ['layer', 'concat', 'hconcat', 'vconcat']) {
      const children = spec[key];
      if (Array.isArray(children)) for (const child of children) visit(child);
    }
  };
  visit(specification);
};

export const getVegaLiteResponsiveDimensions = (source: string): Array<'width' | 'height'> => {
  try {
    const spec: unknown = JSON.parse(source);
    if (!isRecord(spec)) return [];
    // Responsive size is an official top-level single/layer view feature.
    return (['width', 'height'] as const).filter((dimension) => spec[dimension] === 'container');
  } catch {
    return [];
  }
};
