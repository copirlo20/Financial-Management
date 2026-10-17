"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "@fm/shared/i18n/config";
import { createTranslator } from "@fm/shared/i18n/translate";

const LanguageContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ language, children }: { language: Locale; children: React.ReactNode }) {
  return <LanguageContext value={language}>{children}</LanguageContext>;
}

// Client-side counterpart of getI18n() in lib/i18n/server.ts.
export function useI18n() {
  const language = useContext(LanguageContext);
  return useMemo(
    () => ({ t: createTranslator(language), locale: INTL_LOCALES[language], language }),
    [language],
  );
}
