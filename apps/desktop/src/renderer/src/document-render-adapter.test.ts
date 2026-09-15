import type { PlantUmlRenderRequest } from '@fuxian/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createDesktopPlantUmlRenderer,
  createDocumentRenderAdapter,
} from './document-render-adapter';

describe('document render adapter', () => {
  it.each(['math-inline', 'math-display'] as const)(
    'renders Chinese text in %s without requiring text commands',
    async (kind) => {
      const adapter = createDocumentRenderAdapter('https://server.test', vi.fn());
      const source = String.raw`达到满分所需的支付订单数 \ge 曝光次数\times y+3`;
      const result = await adapter.render(
        { id: 'chinese-math', kind, source },
        new AbortController().signal,
      );

      expect(result.kind).toBe('math');
      if (result.kind !== 'math') throw new Error('Expected a math result');
      expect(result.html).toContain('<math');
      expect(result.html).toContain('<mtext>');
      expect(result.html).toContain(source);
      expect(result.html).not.toContain('katex-error');
    },
  );

  it.each([String.raw`中文 + \frac{1}{`, String.raw`中文 + \unknowncommand`])(
    'still rejects invalid formulas containing Chinese: %s',
    async (source) => {
      const adapter = createDocumentRenderAdapter('https://server.test', vi.fn());
      await expect(
        adapter.render(
          { id: 'invalid-math', kind: 'math-display', source },
          new AbortController().signal,
        ),
      ).rejects.toThrow(/expected|Undefined control sequence/i);
    },
  );

  it('keeps untrusted math commands disabled when rendering Chinese', async () => {
    const adapter = createDocumentRenderAdapter('https://server.test', vi.fn());
    const result = await adapter.render(
      {
        id: 'untrusted-math',
        kind: 'math-inline',
        source: String.raw`中文 + \href{https://example.com}{链接}`,
      },
      new AbortController().signal,
    );
    expect(result.kind).toBe('math');
    if (result.kind !== 'math') throw new Error('Expected a math result');
    expect(result.html).not.toContain('href=');
  });

  it('uses the current PlantUML server without changing the source', async () => {
    const renderPlantUml = vi.fn(async () => '<svg><text>diagram</text></svg>');
    const adapter = createDocumentRenderAdapter('https://first.test/plantuml', renderPlantUml);
    adapter.setPlantUmlServerUrl('http://127.0.0.1:8080/plantuml');
    const signal = new AbortController().signal;
    const source = '@startuml\n!theme mars\nAlice -> Bob\n@enduml\n';

    await expect(
      adapter.render({ id: 'plantuml-1', kind: 'plantuml', source }, signal),
    ).resolves.toEqual({
      kind: 'plantuml',
      svg: '<svg><text>diagram</text></svg>',
    });
    expect(renderPlantUml).toHaveBeenCalledWith(source, 'http://127.0.0.1:8080/plantuml', signal);
  });

  it('renders Infographic through its dedicated renderer', async () => {
    const renderInfographic = vi.fn(async () => '<svg><foreignObject /></svg>');
    const adapter = createDocumentRenderAdapter(
      'https://first.test/plantuml',
      vi.fn(),
      vi.fn(),
      renderInfographic,
    );
    const signal = new AbortController().signal;
    const source = 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n';

    await expect(
      adapter.render({ id: 'infographic-1', kind: 'infographic', source }, signal),
    ).resolves.toEqual({ kind: 'infographic', svg: '<svg><foreignObject /></svg>' });
    expect(renderInfographic).toHaveBeenCalledWith(source, signal);
  });

  it('forwards cancellation to the desktop bridge', async () => {
    let finishRequest: ((value: { svg: string }) => void) | undefined;
    const bridge = {
      cancelPlantUmlRender: vi.fn(),
      renderPlantUml: vi.fn(
        (request: PlantUmlRenderRequest) =>
          new Promise<{ svg: string }>((resolve) => {
            void request;
            finishRequest = resolve;
          }),
      ),
    };
    const renderer = createDesktopPlantUmlRenderer(bridge);
    const controller = new AbortController();
    const rendering = renderer('source', 'https://server.test/plantuml', controller.signal);
    const firstRequest = bridge.renderPlantUml.mock.calls[0]?.[0];
    if (!firstRequest) throw new Error('PlantUML render request was not sent.');
    const requestId = firstRequest.requestId;
    expect(requestId).toBeTypeOf('string');

    controller.abort();
    expect(bridge.cancelPlantUmlRender).toHaveBeenCalledWith(requestId);
    finishRequest?.({ svg: '<svg />' });
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
  });
});
