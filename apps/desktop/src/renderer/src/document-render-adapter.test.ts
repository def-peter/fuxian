import type { PlantUmlRenderRequest } from '@fuxian/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createDesktopPlantUmlRenderer,
  createDocumentRenderAdapter,
  hasExplicitDiagramStyle,
  optimizePlantUmlSource,
} from './document-render-adapter';

describe('document render adapter', () => {
  it('uses the current PlantUML server without changing the source', async () => {
    const renderPlantUml = vi.fn(async () => '<svg><text>diagram</text></svg>');
    const adapter = createDocumentRenderAdapter(
      'light',
      'https://first.test/plantuml',
      renderPlantUml,
    );
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

  it('renders Infographic independently from diagram optimization', async () => {
    const renderInfographic = vi.fn(async () => '<svg><foreignObject /></svg>');
    const adapter = createDocumentRenderAdapter(
      'light',
      'https://first.test/plantuml',
      vi.fn(),
      true,
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

  it('optimizes only diagrams without author styling and never mutates the original source', () => {
    const plain = '@startuml\nAlice -> Bob\n@enduml';
    const styled = '@startuml\n!theme mars\nskinparam shadowing true\nAlice -> Bob\n@enduml';

    expect(optimizePlantUmlSource(plain, true)).toContain('skinparam backgroundColor transparent');
    expect(optimizePlantUmlSource(plain, false)).toBe(plain);
    expect(optimizePlantUmlSource(styled, true)).toBe(styled);
    expect(hasExplicitDiagramStyle('mermaid', '%%{init: {"theme":"forest"}}%%\ngraph TD')).toBe(
      true,
    );
    expect(hasExplicitDiagramStyle('mermaid', 'graph TD\nA --> B')).toBe(false);
    expect(plain).toBe('@startuml\nAlice -> Bob\n@enduml');
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
