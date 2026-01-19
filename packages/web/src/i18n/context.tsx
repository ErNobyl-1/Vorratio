import { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { de as dateFnsDe } from 'date-fns/locale';
import { enUS as dateFnsEn } from 'date-fns/locale';
import enTranslations from './locales/en.yaml';
import deTranslations from './locales/de.yaml';
import type { Locale, LocaleContextType, TranslationFunction } from './types';
import { interpolate, getNestedValue } from './utils';
import { settings } from '../lib/api';

const DEFAULT_LOCALE: Locale = (import.meta.env.VITE_DEFAULT_LOCALE as Locale) || 'en';

const translations: Record<Locale, Record<string, unknown>> = {
  en: enTranslations,
  de: deTranslations,
};

const dateFnsLocales = {
  en: dateFnsEn,
  de: dateFnsDe,
};

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch locale from API on mount
  useEffect(() => {
    settings.get()
      .then((data) => {
        if (data.locale === 'en' || data.locale === 'de') {
          setLocaleState(data.locale);
        }
      })
      .catch(() => {
        // API error (e.g., not initialized yet), use default
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Save to API (fire and forget, errors handled silently)
    settings.update({ locale: newLocale }).catch(() => {
      // Silently fail if not authenticated or API error
    });
  }, []);

  const t: TranslationFunction = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      const currentTranslations = translations[locale];
      let value = getNestedValue(currentTranslations, key);

      if (params?.count !== undefined && typeof params.count === 'number') {
        const pluralKey = params.count === 1 ? key : `${key}_plural`;
        const pluralValue = getNestedValue(currentTranslations, pluralKey);
        if (pluralValue) {
          value = pluralValue;
        }
      }

      if (typeof value !== 'string') {
        console.warn(`Translation missing: ${key}`);
        return key;
      }

      return params ? interpolate(value, params) : value;
    };
  }, [locale]);

  const dateFnsLocale = dateFnsLocales[locale];

  const contextValue = useMemo(
    () => ({ locale, setLocale, t, dateFnsLocale }),
    [locale, setLocale, t, dateFnsLocale]
  );

  // Show nothing while loading to prevent flash of wrong language
  if (isLoading) {
    return null;
  }

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
