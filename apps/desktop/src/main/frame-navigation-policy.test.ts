import { describe, expect, it } from 'vitest';
import { isPaperPreviewFrameUrl } from './frame-navigation-policy';

describe('paper preview frame navigation policy', () => {
  it('allows only the exact internal paper renderer route', () => {
    const main = 'http://127.0.0.1:5173/';
    expect(
      isPaperPreviewFrameUrl(
        'http://127.0.0.1:5173/?channelId=revision-1&view=paper-preview',
        main,
      ),
    ).toBe(true);
    expect(
      isPaperPreviewFrameUrl('https://example.com/?view=paper-preview&channelId=x', main),
    ).toBe(false);
    expect(isPaperPreviewFrameUrl('http://127.0.0.1:5173/?view=paper-preview', main)).toBe(false);
    expect(
      isPaperPreviewFrameUrl(
        'http://127.0.0.1:5173/?view=paper-preview&channelId=x&extra=true',
        main,
      ),
    ).toBe(false);
  });

  it('supports the packaged file URL without trusting another file', () => {
    const main =
      'file:///Applications/Fuxian.app/Contents/Resources/app.asar/out/renderer/index.html';
    expect(isPaperPreviewFrameUrl(`${main}?channelId=revision-1&view=paper-preview`, main)).toBe(
      true,
    );
    expect(
      isPaperPreviewFrameUrl(
        'file:///tmp/index.html?channelId=revision-1&view=paper-preview',
        main,
      ),
    ).toBe(false);
  });
});
