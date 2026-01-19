import type { Locale as DateFnsLocale } from 'date-fns';

export type Locale = 'en' | 'de';

export interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFunction;
  dateFnsLocale: DateFnsLocale;
}

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;
