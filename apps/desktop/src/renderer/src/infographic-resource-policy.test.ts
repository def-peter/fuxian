import { describe, expect, it, vi } from 'vitest';
import {
  createInfographicResourceFetch,
  sanitizeTrustedInfographicSvgResource,
} from './infographic-resource-policy';

const trustedAsset =
  'https://mdn.alipayobjects.com/infographicservice/afts/img/test-resource/original';

describe('Infographic trusted resources', () => {
  it('prefers explicit local resources without contacting the network', async () => {
    const fetchNetwork = vi.fn<typeof fetch>();
    const fetchResource = createInfographicResourceFetch({
      fetchNetwork,
      preferOnlineResource: () => true,
      resolveLocalResource: async (query) =>
        query === 'lucide/rocket' ? '<svg viewBox="0 0 24 24"><path /></svg>' : undefined,
    });

    const response = await fetchResource(
      'https://www.weavefox.cn/api/v1/infographic/icon?text=lucide%2Frocket&topK=1',
    );

    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      data: ['<svg viewBox="0 0 24 24"><path /></svg>'],
      success: true,
    });
    const missing = await fetchResource(
      'https://www.weavefox.cn/api/v1/infographic/icon?text=lucide%2Fmissing&topK=1',
    );
    expect(missing.status).toBe(404);
    expect(fetchNetwork).not.toHaveBeenCalled();
  });

  it('allows only reviewed search and Alibaba SVG endpoints', async () => {
    const fetchNetwork = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.startsWith('https://www.weavefox.cn/')) {
        return new Response(
          JSON.stringify({
            data: [trustedAsset, 'https://example.test/untrusted.svg'],
            success: true,
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="bad()"><script>bad()</script><path d="M0 0h1" /></svg>',
        { headers: { 'content-type': 'image/svg+xml' } },
      );
    });
    const fetchResource = createInfographicResourceFetch({
      fetchNetwork,
      preferOnlineResource: () => true,
      resolveLocalResource: async () => undefined,
    });

    const search = await fetchResource(
      'https://www.weavefox.cn/api/v1/infographic/icon?text=illustration&topK=1',
    );
    expect(await search.json()).toEqual({ data: [trustedAsset], success: true });

    const asset = await fetchResource(trustedAsset);
    expect(await asset.text()).toContain('<path');
    expect(fetchNetwork).toHaveBeenCalledTimes(2);
    for (const [request] of fetchNetwork.mock.calls) {
      expect(request).toBeInstanceOf(Request);
      expect((request as Request).credentials).toBe('omit');
      expect((request as Request).redirect).toBe('manual');
      expect((request as Request).referrerPolicy).toBe('no-referrer');
    }

    const blocked = await fetchResource('https://example.test/untrusted.svg');
    expect(blocked.status).toBe(403);
    expect(fetchNetwork).toHaveBeenCalledTimes(2);
  });

  it('removes active content and external references from trusted SVG', () => {
    const svg = sanitizeTrustedInfographicSvgResource(
      [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<script>bad()</script>',
        '<animate attributeName="href" to="https://example.test" />',
        '<a href="https://example.test"><path onload="bad()" d="M0 0h1" /></a>',
        '<use href="#safe" /><use href="https://example.test/icon" />',
        '</svg>',
      ].join(''),
    );

    expect(svg).toContain('<path d="M0 0h1" />');
    expect(svg).toContain('href="#safe"');
    expect(svg).not.toMatch(/script|animate|onload|example\.test/iu);
  });
});
