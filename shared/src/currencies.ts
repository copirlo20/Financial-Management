export const SUPPORTED_CURRENCIES = ["VND", "USD", "EUR", "JPY", "GBP", "AUD", "SGD", "KRW", "CNY", "THB"] as const;

// Takes the decimal as a string so large balances are formatted exactly instead of going through a float.
export function formatMoney(amount: string, currency: string, locale = "vi-VN"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount as Intl.StringNumericLiteral,
  );
}
