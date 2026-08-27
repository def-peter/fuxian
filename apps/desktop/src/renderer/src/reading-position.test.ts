import { describe, expect, it } from 'vitest';
import { captureReadingPosition, resolveReadingPosition } from './reading-position';

describe('reading position', () => {
  it('captures the nearest heading and restores its offset after layout changes', () => {
    const position = captureReadingPosition(640, 2_000, [
      { id: 'intro', top: 0 },
      { id: 'setup', top: 600 },
      { id: 'usage', top: 1_100 },
    ]);

    expect(position).toEqual({
      headingId: 'setup',
      headingOffset: 40,
      relativeProgress: 0.32,
    });
    expect(
      resolveReadingPosition(position, 2_600, [
        { id: 'intro', top: 0 },
        { id: 'setup', top: 900 },
        { id: 'usage', top: 1_500 },
      ]),
    ).toBe(940);
  });

  it('falls back to relative progress when the heading no longer exists', () => {
    expect(
      resolveReadingPosition(
        { headingId: 'removed', headingOffset: 20, relativeProgress: 0.4 },
        3_000,
        [{ id: 'replacement', top: 500 }],
      ),
    ).toBe(1_200);
  });

  it('clamps restored positions to the document scroll range', () => {
    expect(
      resolveReadingPosition(
        { headingId: 'ending', headingOffset: 500, relativeProgress: 1 },
        1_000,
        [{ id: 'ending', top: 900 }],
      ),
    ).toBe(1_000);
  });
});
