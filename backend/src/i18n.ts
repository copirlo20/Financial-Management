import { INTL_LOCALES, type Locale } from "@fm/shared/i18n/config";
import { createTranslator } from "@fm/shared/i18n/translate";
import { requestContext } from "./http/context";

// The language of the current request: the frontend sends the choice of the browser with every call.
export async function getLanguage(): Promise<Locale> {
  return requestContext().locale;
}

// t: translate text. locale: Intl tag for formatting numbers, money and dates.
export async function getI18n() {
  const language = requestContext().locale;
  return { t: createTranslator(language), locale: INTL_LOCALES[language], language };
}
