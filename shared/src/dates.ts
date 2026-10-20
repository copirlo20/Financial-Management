// Single product time zone until users can pick their own; decides what "today" means in forms.
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

// Calendar dates travel as "YYYY-MM-DD" strings and are stored in DATE columns as UTC midnight.
export function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
}

export function isoDateToDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function dateToIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Whole days from one calendar date to another (negative when `to` is earlier).
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// Every date the app shows reads dd/mm/yyyy, whatever the language. Calendar dates are stored as UTC
// midnight, so they are read in UTC; a moment in time (when something was created) is read in APP_TIME_ZONE.
function dayMonthYear(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}`;
}

export function formatDate(date: Date): string {
  return dayMonthYear(date, "UTC");
}

// The day of a moment in time, as it was in Vietnam.
export function formatDay(moment: Date): string {
  return dayMonthYear(moment, APP_TIME_ZONE);
}

// dd/mm/yyyy HH:mm, in Vietnam's time.
export function formatDateTime(moment: Date): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(moment);
  return `${dayMonthYear(moment, APP_TIME_ZONE)} ${time}`;
}

// "YYYY-MM-DD" as dd/mm/yyyy; anything else is returned as it is.
export function isoDateToText(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
}

// A date typed by a person, dd/mm/yyyy (one-digit day or month, and "-" or "." as separators, are fine
// too), or already "YYYY-MM-DD": the ISO date, or null when it is not a real calendar date.
export function parseDateText(text: string): string | null {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  const parts: [string, string, string] | null = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  // Day 0 or month 13 give no date at all; 31/02 rolls over to March. A real date comes back unchanged.
  const date = isoDateToDate(result);
  return !Number.isNaN(date.getTime()) && dateToIsoDate(date) === result ? result : null;
}
