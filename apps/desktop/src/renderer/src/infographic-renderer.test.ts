import { describe, expect, it } from 'vitest';
import {
  invalidInfographicSource,
  validateInfographicData,
  validateInfographicThemeConfig,
} from './infographic-policy';
import { resolveInfographicIcon } from './infographic-icons';
import { createInfographicRenderer } from './infographic-renderer';

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

describe('Infographic policy', () => {
  it('rejects remote resources, illustrations, and arbitrary attributes', () => {
    expect(() =>
      validateInfographicData({ items: [{ icon: 'https://example.test/a.svg' }] }),
    ).toThrow(/不允许外部 URL/u);
    expect(() => validateInfographicData({ items: [{ illus: 'coffee' }] })).toThrow(
      /不支持 illus/u,
    );
    expect(() =>
      validateInfographicData({ items: [{ attributes: { onclick: 'bad()' } }] }),
    ).toThrow(/不支持 attributes/u);
  });

  it('accepts official basic data and a bounded color theme', () => {
    expect(() =>
      validateInfographicData({
        lists: [{ desc: '保留官方排版', label: '安全渲染', value: 100 }],
        title: '发布流程',
      }),
    ).not.toThrow();
    expect(() =>
      validateInfographicThemeConfig({ colorBg: '#1f1f1f', colorPrimary: '#61DDAA' }),
    ).not.toThrow();
    expect(() => validateInfographicThemeConfig({ base: { global: { onclick: 'bad' } } })).toThrow(
      /theme\.base/u,
    );
    expect(invalidInfographicSource('test')).toBeInstanceOf(TypeError);
  });
});

describe('Infographic local icons', () => {
  it('resolves official lucide and mdi names without a network service', async () => {
    await expect(resolveInfographicIcon('lucide/trophy')).resolves.toMatch(
      /^<svg[^>]+viewBox="0 0 24 24"/u,
    );
    await expect(resolveInfographicIcon('mdi/rocket-launch')).resolves.toContain('<path');
    await expect(resolveInfographicIcon('earth')).resolves.toContain('<svg');
    await expect(resolveInfographicIcon('unknown-collection/icon')).resolves.toBeUndefined();
  });
});

describe('Infographic renderer', () => {
  it('limits concurrency and terminates active work on cancellation', async () => {
    FakeWorker.instances = [];
    const renderer = createInfographicRenderer(() => new FakeWorker() as unknown as Worker, 2);
    const firstController = new AbortController();
    const first = renderer('first', firstController.signal);
    const second = renderer('second', new AbortController().signal);
    const third = renderer('third', new AbortController().signal);

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
