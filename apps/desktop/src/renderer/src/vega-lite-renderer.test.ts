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
  it.each([
    ['malformed JSON', '{'],
    [
      'remote data',
      JSON.stringify({ data: { url: 'https://example.test/data.json' }, mark: 'bar' }),
    ],
    ['named data', JSON.stringify({ data: { name: 'table' }, mark: 'bar' })],
    ['named datasets', JSON.stringify({ datasets: { table: [] }, mark: 'bar' })],
    ['image marks', JSON.stringify({ data: { values: [] }, mark: 'image' })],
    ['external links', JSON.stringify({ data: { values: [] }, href: 'https://example.test' })],
    [
      'interactive parameters',
      JSON.stringify({ data: { values: [] }, mark: 'point', params: [{ name: 'brush' }] }),
    ],
    [
      'unbounded pivot transforms',
      JSON.stringify({
        data: { values: [] },
        mark: 'bar',
        transform: [{ pivot: 'category', value: 'amount' }],
      }),
    ],
    [
      'random sample transforms',
      JSON.stringify({ data: { values: [] }, mark: 'point', transform: [{ sample: 100 }] }),
    ],
  ])('rejects %s before loading the runtime', (_name, source) => {
    expect(() => parseVegaLiteSource(source)).toThrow(/Vega-Lite specification 无效/u);
  });

  it('limits inline data volume', () => {
    const source = JSON.stringify({
      data: { values: Array.from({ length: 10_001 }, (_, index) => ({ index })) },
      mark: 'point',
    });

    expect(() => parseVegaLiteSource(source)).toThrow('内联数据不能超过 10000 行');
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
