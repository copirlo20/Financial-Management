import { SUPPORTED_CURRENCIES } from "./currencies";

// Every stored rate is "1 USD = rate × quote currency"; any other pair is derived by crossing through USD.
export const RATE_BASE = "USD";
export const QUOTE_CURRENCIES = SUPPORTED_CURRENCIES.filter((currency) => currency !== RATE_BASE);

// Attribution required by the free tier of the rate provider (shown on /settings).
export const RATE_PROVIDER = { name: "ExchangeRate-API", url: "https://www.exchangerate-api.com" };
