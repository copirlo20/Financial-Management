import type { Locale } from "./config";
import { en } from "./en";

export type TranslateArg = string | number;
export type Translate = (text: string, ...args: TranslateArg[]) => string;

// The Vietnamese source text is the lookup key, so Vietnamese renders unchanged and a missing
// translation falls back to Vietnamese instead of showing a raw key. {0}, {1}… are positional arguments.
export function translate(locale: Locale, text: string, args: TranslateArg[] = []): string {
  const template = locale === "en" ? (en[text] ?? text) : text;
  return args.length === 0 ? template : template.replace(/\{(\d+)\}/g, (match, index) => String(args[Number(index)] ?? match));
}

export function createTranslator(locale: Locale): Translate {
  return (text, ...args) => translate(locale, text, args);
}
