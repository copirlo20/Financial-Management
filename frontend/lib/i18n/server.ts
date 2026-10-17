import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, INTL_LOCALES, LOCALE_COOKIE, isLocale, type Locale } from "@fm/shared/i18n/config";
import { createTranslator } from "@fm/shared/i18n/translate";

// The cookie is the single source for rendering; it is synced with the user's saved preference on
// login and whenever the language is switched.
export const getLanguage = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

// t: translate UI text. locale: Intl tag for formatMoney/formatDate.
export const getI18n = cache(async () => {
  const language = await getLanguage();
  return { t: createTranslator(language), locale: INTL_LOCALES[language], language };
});
