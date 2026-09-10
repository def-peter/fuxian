import { describe, expect, it } from 'vitest';
import { renderVegaLiteSvg } from './vega-lite-runtime';

const base = {
  data: {
    values: [
      { category: 'Alpha', x: 1, y: 2 },
      { category: 'Beta', x: 2, y: 4 },
    ],
  },
  mark: 'bar',
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
  },
};

describe('official Vega-Lite runtime compatibility', () => {
  it.each([
    ['container width', { ...base, width: 'container' }],
    ['container height', { ...base, height: 'container' }],
    ['mark width expression', { ...base, mark: { type: 'bar', width: { expr: '20' } } }],
    [
      'named inline data',
      { ...base, datasets: { table: base.data.values }, data: { name: 'table' } },
    ],
    ['inline data format', { ...base, data: { ...base.data, format: { type: 'json' } } }],
    [
      'constant parameter',
      {
        ...base,
        params: [{ name: 'threshold', value: 10 }],
        transform: [{ filter: 'datum.y < threshold' }],
      },
    ],
    ['fold', { ...base, transform: [{ fold: ['x', 'y'] }] }],
    [
      'pivot',
      {
        ...base,
        transform: [{ pivot: 'category', value: 'y', groupby: ['x'] }],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'Alpha', type: 'quantitative' },
        },
      },
    ],
    [
      'regression',
      {
        ...base,
        mark: 'line',
        transform: [{ regression: 'y', on: 'x' }],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
    ],
  ])('renders %s through the real compiler, interpreter, and SVG renderer', async (_name, spec) => {
    const svg = await renderVegaLiteSvg(JSON.stringify(spec));
    expect(svg).toContain('role-mark');
    expect(svg).not.toMatch(/(?:NaN|Infinity)/u);
  });

  it('uses measured container dimensions independently for concurrent views', async () => {
    const source = JSON.stringify({ ...base, width: 'container', height: 'container' });
    const outputs = await Promise.all([
      renderVegaLiteSvg(source, { width: 640, height: 240 }),
      renderVegaLiteSvg(source, { width: 900, height: 360 }),
    ]);
    expect(outputs[0]).toMatch(/<svg[^>]*width="640"[^>]*height="240"/u);
    expect(outputs[1]).toMatch(/<svg[^>]*width="900"[^>]*height="360"/u);
    expect(outputs[0]).toContain('Alpha');
    expect(outputs[1]).toContain('Beta');
  });

  it('treats data field names as data rather than executable configuration', async () => {
    const svg = await renderVegaLiteSvg(
      JSON.stringify({
        ...base,
        datasets: { width: [{ url: 'Alpha', width: 2, params: 3 }] },
        data: { name: 'width' },
        encoding: {
          x: { field: 'url', type: 'nominal' },
          y: { field: 'width', type: 'quantitative' },
        },
      }),
    );
    expect(svg).toContain('Alpha');
  });

  it('renders parameter initial state without requiring interactive controls', async () => {
    const svg = await renderVegaLiteSvg(
      JSON.stringify({
        ...base,
        params: [{ name: 'brush', select: 'interval' }],
        encoding: {
          ...base.encoding,
          color: { condition: { param: 'brush', value: '#ff0000' }, value: '#ccc' },
        },
      }),
    );
    expect(svg).toContain('Alpha');
  });

  it.each([
    [
      'malformed dimensions',
      { ...base, height: { step: '24' } },
      /schema|number|object|match|step|must/u,
    ],
    ['oversized output', { ...base, width: 5000 }, /渲染尺寸/u],
    [
      'remote data without encoding',
      { data: { url: 'https://example.test/data.json' }, mark: 'line' },
      /外部数据源/u,
    ],
    ['remote data', { ...base, data: { url: 'https://example.test/data.json' } }, /外部数据源/u],
    [
      'nested remote data',
      { layer: [{ ...base, data: { url: 'file:///private/data.json' } }] },
      /外部数据源/u,
    ],
    ['image resource', { ...base, mark: 'image' }, /image mark/u],
    [
      'external link',
      { ...base, mark: { type: 'bar', href: 'https://example.test' } },
      /外部链接/u,
    ],
    [
      'oversized inline dataset',
      {
        ...base,
        datasets: { table: Array.from({ length: 10_001 }, () => ({ x: 1 })) },
        data: { name: 'table' },
      },
      /10000 行/u,
    ],
    [
      'invalid expression',
      { ...base, transform: [{ calculate: 'datum.[', as: 'invalid' }] },
      /Unexpected token/u,
    ],
  ])('still rejects %s in the actual rendering path', async (_name, spec, message) => {
    await expect(renderVegaLiteSvg(JSON.stringify(spec))).rejects.toThrow(message);
  });
});
