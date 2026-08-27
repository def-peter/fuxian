import { describe, expect, it } from 'vitest';
import {
  createDefaultReaderPreferences,
  defaultPlantUmlServerUrl,
  normalizePlantUmlServerUrl,
  normalizeReaderPreferences,
  readerPreferenceLimits,
} from './index';

describe('reader preferences', () => {
  it('uses stable defaults for missing or unsupported data', () => {
    expect(normalizeReaderPreferences(undefined)).toEqual(createDefaultReaderPreferences());
    expect(normalizeReaderPreferences({ version: 2 })).toEqual(createDefaultReaderPreferences());
  });

  it('uses the public PlantUML server by default and restores older version-one files', () => {
    expect(createDefaultReaderPreferences().plantUml.serverUrl).toBe(defaultPlantUmlServerUrl);
    expect(normalizeReaderPreferences({ version: 1 }).plantUml.serverUrl).toBe(
      defaultPlantUmlServerUrl,
    );
  });

  it('normalizes safe PlantUML base URLs and rejects ambiguous or credentialed URLs', () => {
    expect(normalizePlantUmlServerUrl(' http://127.0.0.1:8080/plantuml/// ')).toBe(
      'http://127.0.0.1:8080/plantuml',
    );
    expect(normalizePlantUmlServerUrl('https://plantuml.example.test')).toBe(
      'https://plantuml.example.test',
    );
    expect(normalizePlantUmlServerUrl('file:///tmp/plantuml')).toBeUndefined();
    expect(normalizePlantUmlServerUrl('https://user:secret@example.test')).toBeUndefined();
    expect(
      normalizePlantUmlServerUrl('https://example.test/plantuml?token=secret'),
    ).toBeUndefined();
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
      plantUml: { serverUrl: defaultPlantUmlServerUrl },
      version: 1,
    });
  });
});
