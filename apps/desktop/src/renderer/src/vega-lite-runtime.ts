import Ajv from 'ajv';
import { expressionFunction, logger, parse, View, type Loader } from 'vega';
import { expressionInterpreter } from 'vega-interpreter';
import { compile } from 'vega-lite';
import schemaSource from 'vega-lite/vega-lite-schema.json?raw';
import { installVegaTooltipSvgRenderer } from './vega-tooltip-svg';
import {
  assertVegaLiteDataResources,
  invalidVegaLiteSpecification,
  maximumVegaLiteDimension,
  maximumVegaLiteSvgBytes,
  parseVegaLiteSource,
  validateVegaResources,
  type VegaLiteContainerSize,
} from './vega-lite-policy';

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
installVegaTooltipSvgRenderer();

// A worker has no DOM container. Supply measured dimensions through Vega's
// expression API without rewriting author input or compiler-generated signals.
// Key by View so concurrent renders cannot borrow another chart's dimensions.
const containerSizes = new WeakMap<View, VegaLiteContainerSize>();
const originalContainerSize = expressionFunction('containerSize');
expressionFunction('containerSize', function (this: { context: { dataflow: View } }) {
  const size = containerSizes.get(this.context.dataflow);
  return size ? [size.width, size.height] : originalContainerSize.call(this);
});

export const renderVegaLiteSvg = async (
  source: string,
  containerSize: VegaLiteContainerSize = {},
): Promise<string> => {
  const specification = parseVegaLiteSource(source);
  if (!validateSchema(specification)) {
    const detail = validateSchema.errors
      ?.slice(0, 3)
      .map((error) => `${error.instancePath || '顶层'} ${error.message ?? '不符合 schema'}`)
      .join('；');
    throw invalidVegaLiteSpecification(detail || '不符合当前 Vega-Lite schema。');
  }
  assertVegaLiteDataResources(specification);
  const vegaSpecification = compile(specification).spec;
  validateVegaResources(vegaSpecification);
  const runtimeErrors: string[] = [];
  const runtimeLogger = logger();
  runtimeLogger.error = (...messages: unknown[]) => {
    runtimeErrors.push(messages.map(String).join(' '));
    return runtimeLogger;
  };
  const view = new View(parse(vegaSpecification, undefined, { ast: true }), {
    expr: expressionInterpreter,
    loader: blockedLoader,
    logger: runtimeLogger,
    renderer: 'none',
  });
  const size: VegaLiteContainerSize = {};
  for (const dimension of ['width', 'height'] as const) {
    const value = containerSize[dimension];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      size[dimension] = Math.min(maximumVegaLiteDimension, Math.round(value));
    }
  }
  containerSizes.set(view, size);
  try {
    await view.runAsync();
    if (runtimeErrors.length) throw invalidVegaLiteSpecification(runtimeErrors.join('；'));
    for (const dimension of [view.width(), view.height()]) {
      if (!Number.isFinite(dimension) || dimension < 0 || dimension > maximumVegaLiteDimension) {
        throw invalidVegaLiteSpecification(
          `渲染尺寸必须在 0 到 ${maximumVegaLiteDimension} 像素之间。`,
        );
      }
    }
    const svg = await view.toSVG();
    if (runtimeErrors.length) throw invalidVegaLiteSpecification(runtimeErrors.join('；'));
    if (new TextEncoder().encode(svg).byteLength > maximumVegaLiteSvgBytes) {
      throw invalidVegaLiteSpecification(
        `渲染结果不能超过 ${maximumVegaLiteSvgBytes / 1024 / 1024} MB。`,
      );
    }
    return svg;
  } finally {
    view.finalize();
    containerSizes.delete(view);
  }
};
