import type { DocumentThemePreferences } from '@fuxian/document-theme';
import type { ReaderPreferences } from '@fuxian/shared-types';
import type { ResolvedAppearance } from '@/use-reader-preferences';

export const toDocumentThemePreferences = (
  preferences: ReaderPreferences,
  appearance: ResolvedAppearance,
): DocumentThemePreferences => ({
  appearance,
  bodyFamily: preferences.documentTypography.bodyFamily,
  bodySize: preferences.documentTypography.bodySize,
  customWidth: preferences.documentWidth.customWidth,
  lineHeight: preferences.documentTypography.lineHeight,
  widthMode: preferences.documentWidth.mode,
});
