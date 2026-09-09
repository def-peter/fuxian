import { renderModule } from 'vega';

interface TooltipItem {
  tooltip?: unknown;
}

interface SvgStringRenderer {
  attr(
    scene: unknown,
    item: TooltipItem,
    attributes: unknown,
    tag?: string,
  ): Record<string, unknown>;
}

// Vega's render-module API supports a getter and a headless constructor, which
// its current TypeScript declarations do not describe. Keep this adapter local
// to the worker and the pinned SVG renderer; never change scenegraph geometry.
export const installVegaTooltipSvgRenderer = (): void => {
  const module = (
    renderModule as unknown as (name: string) => {
      headless: new (...args: unknown[]) => SvgStringRenderer;
    }
  )('svg');
  class TooltipSvgRenderer extends module.headless {
    override attr(scene: unknown, item: TooltipItem, attributes: unknown, tag?: string) {
      const result = super.attr(scene, item, attributes, tag);
      if (tag && !tag.startsWith('bg') && item.tooltip != null) {
        result['data-vega-tooltip'] = JSON.stringify(item.tooltip);
        result.tabindex = 0;
      }
      return result;
    }
  }
  renderModule('svg', {
    ...module,
    headless: TooltipSvgRenderer,
  } as unknown as Parameters<typeof renderModule>[1]);
};
