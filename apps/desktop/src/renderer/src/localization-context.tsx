import { resolveUiLocale, type UiLocale } from '@fuxian/shared-types';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { createTranslator, type Translator } from '../../localization';
import { useReaderPreferences } from '@/use-reader-preferences';

interface LocalizationContextValue {
  locale: UiLocale;
  t: Translator;
}

const initialSystemLocale = (): string =>
  new URLSearchParams(globalThis.location.search).get('systemLocale') ?? '';

const LocalizationContext = createContext<LocalizationContextValue>({
  locale: 'en-US',
  t: createTranslator('en-US'),
});

export function LocalizationProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const { preferences } = useReaderPreferences();
  const locale = resolveUiLocale(preferences.language, initialSystemLocale());
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    const view = new URLSearchParams(globalThis.location.search).get('view');
    document.title = view === 'settings' ? value.t('浮现设置') : value.t('浮现');
  }, [locale, value]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

// This hook intentionally shares the provider module so its context cannot be imported incorrectly.
// eslint-disable-next-line react-refresh/only-export-components
export const useLocalization = (): LocalizationContextValue => useContext(LocalizationContext);
