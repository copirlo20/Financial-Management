import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";

// The <option>s of a currency picker: every currency the app supports, by its code.
export function CurrencyOptions() {
  return SUPPORTED_CURRENCIES.map((code) => (
    <option key={code} value={code}>
      {code}
    </option>
  ));
}
