import { describe, expect, it } from 'vitest';
import {
  createDefaultReaderPreferences,
  normalizeReaderPreferences,
  readerPreferenceLimits,
} from './index';

describe('reader preferences', () => {
  it('uses stable defaults for missing or unsupported data', () => {
    expect(normalizeReaderPreferences(undefined)).toEqual(createDefaultReaderPreferences());
    expect(normalizeReaderPreferences({ version: 2 })).toEqual(createDefaultReaderPreferences());
  });

  it('clamps extreme numeric values while preserving valid choices', () => {
    expect(
      normalizeReaderPreferences({
        appearance: 'dark',
        documentTypography: {
          bodyFamily: 'sans-serif',
          bodySize: 200,
          lineHeight: -1,
        },
        documentWidth: { customWidth: 10_000, mode: 'custom' },
        version: 1,
      }),
    ).toEqual({
      appearance: 'dark',
      documentTypography: {
        bodyFamily: 'sans-serif',
        bodySize: readerPreferenceLimits.bodySize.max,
        lineHeight: readerPreferenceLimits.lineHeight.min,
      },
      documentWidth: {
        customWidth: readerPreferenceLimits.customWidth.max,
        mode: 'custom',
      },
      version: 1,
    });
  });
});
