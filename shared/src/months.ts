import { todayIsoDate } from "./dates";
import type { Translate } from "./i18n/translate";

// Months travel as "YYYY-MM" strings.
export function currentMonth(): string {
  return todayIsoDate().slice(0, 7);
}

export function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function shiftMonth(month: string, delta: number): string {
  const date = monthStart(month);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string, t: Translate): string {
  const [year, monthNumber] = month.split("-");
  return t("Tháng {0}/{1}", Number(monthNumber), year);
}
