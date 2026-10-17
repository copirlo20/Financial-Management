import type { Translate } from "./i18n/translate";

// A row of an uploaded statement that could not be read, and why (untranslated message).
export type RowError = { rowNumber: number; message: string };

const MAX_STORED_ERRORS = 20;

type StoredErrors = { rows: { row: number; message: string }[]; more: number };

// Row errors are stored as data (row number + untranslated message), not as finished text,
// so the result page can show them in whatever language the reader is using.
export function serializeImportErrors(errors: RowError[]): string | null {
  if (errors.length === 0) return null;
  const stored: StoredErrors = {
    rows: errors.slice(0, MAX_STORED_ERRORS).map((error) => ({ row: error.rowNumber, message: error.message })),
    more: Math.max(0, errors.length - MAX_STORED_ERRORS),
  };
  return JSON.stringify(stored);
}

export function formatImportErrors(stored: string | null, t: Translate): string | null {
  if (!stored) return null;
  let parsed: StoredErrors;
  try {
    parsed = JSON.parse(stored) as StoredErrors;
    if (!Array.isArray(parsed.rows)) return stored;
  } catch {
    // Batches imported before errors were stored as data hold plain text; show it as it is.
    return stored;
  }
  const lines = parsed.rows.map((error) => t("Dòng {0}: {1}", error.row, t(error.message)));
  if (parsed.more > 0) lines.push(t("… và {0} dòng khác.", parsed.more));
  return lines.join("\n");
}

// Spreadsheet-style name of a column: 0 -> A, 25 -> Z, 26 -> AA.
export function columnLetter(index: number): string {
  let letter = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) letter = String.fromCharCode(65 + (n % 26)) + letter;
  return letter;
}
