import { describe, expect, it } from 'vitest';
import {
  createDefaultReaderPreferences,
  defaultPlantUmlServerUrl,
  normalizePlantUmlServerUrl,
  normalizeReaderPreferences,
  readerPreferenceLimits,
} from './index';

describe('reader preferences', () => {
  it('defaults finished documents to 15px sans-serif typography', () => {
    expect(createDefaultReaderPreferences().documentTypography).toEqual({
      bodyFamily: 'sans-serif',
      bodySize: 15,
      lineHeight: 1.85,
    });
  });

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

  it('drops the retired diagram-optimization field from existing preference files', () => {
    const normalized = normalizeReaderPreferences({
      diagram: { optimize: true },
      version: 1,
    });

    expect(normalized).not.toHaveProperty('diagram');
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
      shell: { contentOutlineExpanded: true, documentSessionExpanded: true },
      version: 1,
    });
  });

  it('preserves valid typography saved by existing users', () => {
    expect(
      normalizeReaderPreferences({
        documentTypography: {
          bodyFamily: 'serif',
          bodySize: 17,
          lineHeight: 1.7,
        },
        version: 1,
      }).documentTypography,
    ).toEqual({ bodyFamily: 'serif', bodySize: 17, lineHeight: 1.7 });
  });

  it('falls back invalid typography fields independently', () => {
    expect(
      normalizeReaderPreferences({
        documentTypography: {
          bodyFamily: 'display',
          bodySize: Number.NaN,
          lineHeight: 1.7,
        },
        version: 1,
      }).documentTypography,
    ).toEqual({ bodyFamily: 'sans-serif', bodySize: 15, lineHeight: 1.7 });
  });

  it('preserves independent shell-region preferences', () => {
    expect(
      normalizeReaderPreferences({
        shell: { contentOutlineExpanded: false, documentSessionExpanded: false },
        version: 1,
      }).shell,
    ).toEqual({ contentOutlineExpanded: false, documentSessionExpanded: false });
  });
});
