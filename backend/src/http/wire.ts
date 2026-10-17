import { Prisma } from "@fm/database";
import { DATE_TAG, DECIMAL_TAG } from "@fm/shared/wire";

// Prepares a value for JSON: decimals and dates are tagged so the frontend gets them back as decimals
// and dates instead of strings (see decode in frontend/lib/api/wire.ts).
export function encode(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return { [DATE_TAG]: value.toISOString() };
  if (Prisma.Decimal.isDecimal(value)) return { [DECIMAL_TAG]: value.toString() };
  if (Array.isArray(value)) return value.map(encode);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
}
