/// <reference lib="webworker" />

import Ajv from 'ajv';
import type { Loader } from 'vega';
import { parse, parseExpression, View } from 'vega';
import { expressionInterpreter } from 'vega-interpreter';
import { compile } from 'vega-lite';
import schemaSource from 'vega-lite/vega-lite-schema.json?raw';
import {
  invalidVegaLiteSpecification,
  isRecord,
  maximumVegaLiteSvgBytes,
  parseVegaLiteSource,
} from './vega-lite-policy';

interface RenderRequest {
  id: number;
  source: string;
}

type RenderResponse =
  | { id: number; ok: true; svg: string }
  | { error: string; errorName: string; id: number; ok: false };

const rejectExternalResource = (resource: string): Promise<never> =>
  Promise.reject(invalidVegaLiteSpecification(`不允许加载外部资源：${resource}`));

const blockedLoader: Loader = {
  file: rejectExternalResource,
  http: rejectExternalResource,
  load: rejectExternalResource,
  sanitize: rejectExternalResource,
};

const validateSchema = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(
  JSON.parse(schemaSource),
);
const expressionKeys = new Set(['expr', 'init', 'signal', 'test', 'update']);
const blockedExpressionFunctions = new Set([
  'containerSize',
  'debug',
  'encode',
  'group',
  'info',
  'inScope',
  'intersect',
  'item',
  'lassoAppend',
  'lassoPath',
  'modify',
  'now',
  'pinchAngle',
  'pinchDistance',
  'random',
  'screen',
  'setdata',
  'view',
  'warn',
  'windowSize',
  'x',
  'xy',
  'y',
]);

const assertDeterministicExpression = (source: string): void => {
  let expression: unknown;
  try {
    expression = parseExpression(source);
  } catch {
    throw invalidVegaLiteSpecification('包含无法解析的表达式。');
  }
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!isRecord(value)) return;
    if (
      value.type === 'CallExpression' &&
      isRecord(value.callee) &&
      typeof value.callee.name === 'string' &&
      blockedExpressionFunctions.has(value.callee.name)
    ) {
      throw invalidVegaLiteSpecification(`不支持 ${value.callee.name}() 表达式。`);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(expression);
};

const validateCompiledVegaSpecification = (value: unknown, insideValues = false): void => {
  if (Array.isArray(value)) {
    for (const child of value) validateCompiledVegaSpecification(child, insideValues);
    return;
  }
  if (!isRecord(value)) return;
  if (!insideValues) {
    if ('url' in value || 'href' in value) {
      throw invalidVegaLiteSpecification('编译结果包含外部 URL 或链接。');
    }
    if (value.type === 'image') {
      throw invalidVegaLiteSpecification('编译结果包含 image mark。');
    }
    for (const [key, child] of Object.entries(value)) {
      if (expressionKeys.has(key) && typeof child === 'string') {
        assertDeterministicExpression(child);
      }
    }
  }
  for (const [key, child] of Object.entries(value)) {
    validateCompiledVegaSpecification(child, insideValues || key === 'values');
  }
};

const render = async (source: string): Promise<string> => {
  const specification = parseVegaLiteSource(source);
  if (!validateSchema(specification)) {
    const detail = validateSchema.errors
      ?.slice(0, 3)
      .map((error) => `${error.instancePath || '顶层'} ${error.message ?? '不符合 schema'}`)
      .join('；');
    throw invalidVegaLiteSpecification(detail || '不符合当前 Vega-Lite schema。');
  }
  const vegaSpecification = compile(specification).spec;
  validateCompiledVegaSpecification(vegaSpecification);
  const view = new View(parse(vegaSpecification, undefined, { ast: true }), {
    expr: expressionInterpreter,
    loader: blockedLoader,
    renderer: 'none',
  });
  try {
    const svg = await view.toSVG();
    if (new TextEncoder().encode(svg).byteLength > maximumVegaLiteSvgBytes) {
      throw invalidVegaLiteSpecification(
        `渲染结果不能超过 ${maximumVegaLiteSvgBytes / 1024 / 1024} MB。`,
      );
    }
    return svg;
  } finally {
    view.finalize();
  }
};

self.addEventListener('message', (event: MessageEvent<RenderRequest>) => {
  const { id, source } = event.data;
  void render(source).then(
    (svg) => self.postMessage({ id, ok: true, svg } satisfies RenderResponse),
    (error: unknown) =>
      self.postMessage({
        error: error instanceof Error ? error.message : 'Vega-Lite 渲染失败。',
        errorName: error instanceof Error ? error.name : 'Error',
        id,
        ok: false,
      } satisfies RenderResponse),
  );
});
