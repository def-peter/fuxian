import type { PlantUmlRenderRequest } from '@fuxian/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createDesktopPlantUmlRenderer,
  createDocumentRenderAdapter,
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
