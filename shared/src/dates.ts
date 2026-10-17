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

export function formatDate(date: Date, locale = "vi-VN"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(date);
}
