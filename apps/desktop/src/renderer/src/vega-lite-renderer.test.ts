import { describe, expect, it } from 'vitest';
import { createVegaLiteRenderer, parseVegaLiteSource, renderVegaLite } from './vega-lite-renderer';

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly listeners = new Map<string, ((event: MessageEvent<unknown>) => void)[]>();
  request?: { id: number; source: string };
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  postMessage(request: { id: number; source: string }): void {
    this.request = request;
  }

  respond(svg: string): void {
    for (const listener of this.listeners.get('message') ?? []) {
      listener(new MessageEvent('message', { data: { id: this.request?.id, ok: true, svg } }));
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('Vega-Lite renderer', () => {
  it.each(['width', 'height'])('preserves step-based %s in concatenated charts', (dimension) => {
    const specification = {
      data: { values: [{ category: 'A', value: 10 }] },
      hconcat: [
        {
          mark: 'bar',
          [dimension]: { step: 24 },
          encoding: {
            x: {
              field: dimension === 'width' ? 'category' : 'value',
              type: dimension === 'width' ? 'nominal' : 'quantitative',
            },
            y: {
              field: dimension === 'height' ? 'category' : 'value',
              type: dimension === 'height' ? 'nominal' : 'quantitative',
            },
          },
        },
      ],
    };
    expect(parseVegaLiteSource(JSON.stringify(specification))).toEqual(specification);
  });

  it.each(['{', '[]', 'null'])('rejects invalid JSON roots: %s', (source) => {
    expect(() => parseVegaLiteSource(source)).toThrow(/Vega-Lite specification 无效/u);
  });

  it('bounds source size and JSON complexity before loading the runtime', () => {
    expect(() =>
      parseVegaLiteSource(JSON.stringify({ description: 'x'.repeat(512 * 1024) })),
    ).toThrow('KB');
    let nested: unknown = {};
    for (let index = 0; index < 66; index++) nested = { child: nested };
    expect(() => parseVegaLiteSource(JSON.stringify(nested))).toThrow('嵌套层级过深');
  });

  it('honors cancellation before starting a worker', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(renderVegaLite('{}', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('limits worker concurrency and terminates active work on cancellation', async () => {
    FakeWorker.instances = [];
    const renderer = createVegaLiteRenderer(() => new FakeWorker() as unknown as Worker, 2);
    const firstController = new AbortController();
    const first = renderer('{}', firstController.signal);
    const second = renderer('{}', new AbortController().signal);
    const third = renderer('{}', new AbortController().signal);

    expect(FakeWorker.instances).toHaveLength(2);
    firstController.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(3);

    FakeWorker.instances[1]?.respond('<svg id="second" />');
    FakeWorker.instances[2]?.respond('<svg id="third" />');
    await expect(second).resolves.toContain('second');
    await expect(third).resolves.toContain('third');
  });
});
