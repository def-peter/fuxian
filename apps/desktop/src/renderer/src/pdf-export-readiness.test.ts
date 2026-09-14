import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { waitForExportImages } from './pdf-export-readiness';

afterEach(() => vi.useRealTimers());

describe('image readiness before pagination', () => {
  const createImage = () => {
    const dom = new JSDOM(
      '<span class="document-image"><img src="https://example.com/slow"><span class="resource-error" hidden>Image failed</span></span>',
    );
    const image = dom.window.document.querySelector('img')!;
    Object.defineProperty(image, 'complete', { value: false });
    return { dom, image };
  };

  it('settles loaded images without changing their source', async () => {
    vi.useFakeTimers();
    const { dom, image } = createImage();
    const pending = waitForExportImages(dom.window.document, 100);
    Object.defineProperty(image, 'naturalWidth', { value: 160 });
    image.dispatchEvent(new dom.window.Event('load'));
    await pending;
    expect(image.getAttribute('src')).toBe('https://example.com/slow');
    expect(vi.getTimerCount()).toBe(0);
    dom.window.close();
  });

  it('bounds stalled downloads and fixes an inline failure before pagination', async () => {
    vi.useFakeTimers();
    const { dom, image } = createImage();
    // A progressive image may expose dimensions before its download finishes.
    Object.defineProperty(image, 'naturalWidth', { value: 160 });
    const pending = waitForExportImages(dom.window.document, 100);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(image.hidden).toBe(true);
    expect(image.hasAttribute('src')).toBe(false);
    expect(dom.window.document.querySelector<HTMLElement>('.resource-error')?.hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    dom.window.close();
  });

  it('cancels obsolete image waits and removes their timers', async () => {
    vi.useFakeTimers();
    const { dom } = createImage();
    const controller = new AbortController();
    const pending = waitForExportImages(dom.window.document, 100, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
    dom.window.close();
  });

  it('shows an inline failure for a remote HTTP error instead of a broken image', async () => {
    vi.useFakeTimers();
    const { dom, image } = createImage();
    const pending = waitForExportImages(dom.window.document, 100);
    image.dispatchEvent(new dom.window.Event('error'));
    await pending;
    expect(image.hidden).toBe(true);
    expect(dom.window.document.querySelector<HTMLElement>('.resource-error')?.hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    dom.window.close();
  });
});
