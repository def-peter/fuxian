/// <reference lib="webworker" />

import { renderVegaLiteSvg } from './vega-lite-runtime';
import type { VegaLiteContainerSize } from './vega-lite-policy';

self.addEventListener(
  'message',
  (event: MessageEvent<{ id: number; source: string; containerSize?: VegaLiteContainerSize }>) => {
    const { id, source, containerSize } = event.data;
    void renderVegaLiteSvg(source, containerSize).then(
      (svg) => self.postMessage({ id, ok: true, svg }),
      (error: unknown) =>
        self.postMessage({
          error: error instanceof Error ? error.message : 'Vega-Lite 渲染失败。',
          errorName: error instanceof Error ? error.name : 'Error',
          id,
          ok: false,
        }),
    );
  },
);
