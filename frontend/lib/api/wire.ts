import Decimal from "decimal.js";
import { DATE_TAG, DECIMAL_TAG } from "@fm/shared/wire";

// Turns the tagged values in a backend response back into what they were: decimals (so money is never
// a float) and dates. The counterpart of encode in backend/src/http/wire.ts.
export function decode(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(decode);
  const record = value as Record<string, unknown>;
  if (typeof record[DECIMAL_TAG] === "string") return new Decimal(record[DECIMAL_TAG]);
  if (typeof record[DATE_TAG] === "string") return new Date(record[DATE_TAG]);
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]));
}
