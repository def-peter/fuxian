import { describe, expect, it } from 'vitest';
import { getPalettes, parseSyntax } from '@antv/infographic';
import {
  invalidInfographicSource,
  isSupportedInfographicTemplate,
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
  it('rejects remote resources, resource objects, and arbitrary attributes', () => {
    expect(() =>
      validateInfographicData({ items: [{ icon: 'https://example.test/a.svg' }] }),
    ).toThrow(/不允许外部 URL/u);
    expect(() => validateInfographicData({ items: [{ illus: 'coffee' }] })).not.toThrow();
    expect(() =>
      validateInfographicData({ items: [{ attributes: { onclick: 'bad()' } }] }),
    ).toThrow(/不支持 attributes/u);
    expect(() =>
      validateInfographicData({ items: [{ icon: { source: 'remote', value: 'example.test' } }] }),
    ).toThrow(/图标和插图只支持/u);
    expect(() =>
      validateInfographicData({ items: [{ illus: { source: 'remote', value: 'example.test' } }] }),
    ).toThrow(/图标和插图只支持/u);
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
    const officialPalettes = getPalettes();
    expect(() =>
      validateInfographicThemeConfig({ palette: 'antv' }, officialPalettes),
    ).not.toThrow();
    expect(() =>
      validateInfographicThemeConfig({ palette: 'spectral' }, officialPalettes),
    ).not.toThrow();
    expect(() => validateInfographicThemeConfig({ palette: 'unknown' }, officialPalettes)).toThrow(
      /theme\.palette/u,
    );
    expect(() => validateInfographicThemeConfig({ base: { global: { onclick: 'bad' } } })).toThrow(
      /theme\.base/u,
    );
    expect(invalidInfographicSource('test')).toBeInstanceOf(TypeError);
  });

  it('accepts the complete official resource combination from issue 37', () => {
    const source = `infographic quadrant-quarter-circular
data
  title 企业优势列表
  desc 展示企业在不同维度上的核心优势与表现值
  compares
    - label 品牌影响力
      value 85
      desc 在目标用户群中具备较强认知与信任度
      time 2021
      icon mingcute/diamond-2-fill
      illus creative-experiment
    - label 技术研发力
      value 90
      desc 拥有自研核心系统与持续创新能力
      time 2022
      icon mingcute/code-fill
      illus code-thinking
    - label 市场增长快
      value 78
      desc 近一年用户规模实现快速增长
      time 2023
      icon mingcute/wallet-4-line
      illus business-analytics
    - label 服务满意度
      value 88
      desc 用户对服务体系整体评分较高
      time 2020
      icon mingcute/happy-line
      illus feeling-happy
    - label 数据资产全
      value 92
      desc 构建了完整用户标签与画像体系
      time 2022
      icon mingcute/user-4-line
      illus mobile-photos
    - label 创新能力强
      value 83
      desc 新产品上线频率高于行业平均
      time 2023
      icon mingcute/rocket-line
      illus creativity
theme light
  palette antv`;
    const parsed = parseSyntax(source);

    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.options).toMatchObject({
      template: 'quadrant-quarter-circular',
      theme: 'light',
      themeConfig: { palette: 'antv' },
    });
    expect(() => validateInfographicData(parsed.options.data)).not.toThrow();
    expect(() =>
      validateInfographicThemeConfig(parsed.options.themeConfig, getPalettes()),
    ).not.toThrow();
  });

  it('supports static sequence and word-cloud templates by capability', () => {
    expect(isSupportedInfographicTemplate('sequence-interaction-default-badge-card')).toBe(true);
    expect(isSupportedInfographicTemplate('chart-wordcloud')).toBe(true);
    expect(isSupportedInfographicTemplate('chart-wordcloud-rotate')).toBe(true);
    expect(isSupportedInfographicTemplate('relation-dagre-flow-tb-animated-badge-card')).toBe(
      false,
    );
    expect(isSupportedInfographicTemplate('sequence-interaction-wide-animated-compact-card')).toBe(
      false,
    );
    expect(isSupportedInfographicTemplate('sequence-timeline-simple-illus')).toBe(true);
    expect(isSupportedInfographicTemplate('quadrant-simple-illus')).toBe(true);
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
