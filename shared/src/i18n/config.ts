export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "locale";
export const LOCALE_LABELS: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

// Tag handed to Intl for numbers, money and dates.
export const INTL_LOCALES: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
