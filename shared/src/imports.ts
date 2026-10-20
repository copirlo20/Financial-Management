import { formatDate } from "./dates";
import type { Translate } from "./i18n/translate";

// One value of a row: where it came from and what it holds. The label is either a column of the file,
// "A — Ngày giao dịch" (its letter and, when the file names it, its heading), or a field the assistant
// read, such as "Số tiền" (Vietnamese source text, translated on display). Column labels always start with
// a letter and a dash, so translating every label leaves them as they are.
export type RowCell = [label: string, value: string];

// A row of an uploaded statement that could not be read, why (untranslated message), and what it held.
export type RowError = { rowNumber: number; message: string; cells?: RowCell[] };

type StoredRowError = { row: number; message: string; cells?: RowCell[] };
export type StoredImportErrors = { rows: StoredRowError[]; more: number };

const MAX_STORED_ERRORS = 100;
const MAX_CELL_LENGTH = 200;

// A cell of an uploaded file as text: a date as dd/mm/yyyy, a number as written in the file.
export function cellText(cell: string | number | Date | null): string {
  if (cell === null) return "";
  return cell instanceof Date ? formatDate(cell) : String(cell);
}

// Spreadsheet-style name of a column: 0 -> A, 25 -> Z, 26 -> AA.
export function columnLetter(index: number): string {
  let letter = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) letter = String.fromCharCode(65 + (n % 26)) + letter;
  return letter;
}

// The cells of a row of the file, each labelled with its column; `header` is the row naming the columns.
export function fileRowCells(row: (string | number | Date | null)[], header: (string | number | Date | null)[] = []): RowCell[] {
  return row.map((cell, index) => {
    const name = cellText(header[index] ?? null).replace(/\s+/g, " ").trim();
    return [name ? `${columnLetter(index)} — ${name}` : columnLetter(index), cellText(cell).slice(0, MAX_CELL_LENGTH)];
  });
}

// What the assistant read for a row it could not turn into a transaction.
export function readRowCells(read: { date: string; amount: string; description: string }): RowCell[] {
  return [
    ["Ngày", read.date],
    ["Số tiền", read.amount],
    ["Diễn giải", read.description.slice(0, MAX_CELL_LENGTH)],
  ];
}

// The first errors as they are kept and shown, and how many more there were.
export function storedImportErrors(errors: RowError[]): StoredImportErrors {
  return {
    rows: errors.slice(0, MAX_STORED_ERRORS).map((error) => ({ row: error.rowNumber, message: error.message, cells: error.cells })),
    more: Math.max(0, errors.length - MAX_STORED_ERRORS),
  };
}

// Row errors are stored as data (row number, untranslated message, the row's cells), not as finished
// text, so the result page can show them in whatever language the reader is using.
export function serializeImportErrors(errors: RowError[]): string | null {
  return errors.length === 0 ? null : JSON.stringify(storedImportErrors(errors));
}

// The stored errors as data; plain text for batches imported before errors were stored that way.
export function readImportErrors(stored: string | null): StoredImportErrors | string | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as StoredImportErrors;
    return Array.isArray(parsed.rows) ? parsed : stored;
  } catch {
    return stored;
  }
}

// The errors as lines of text ("Dòng 3: …"), for a message on a form.
export function formatImportErrors(stored: string | null, t: Translate): string | null {
  const errors = readImportErrors(stored);
  if (errors === null || typeof errors === "string") return errors;
  const lines = errors.rows.map((error) => t("Dòng {0}: {1}", error.row, t(error.message)));
  if (errors.more > 0) lines.push(t("… và {0} dòng khác.", errors.more));
  return lines.join("\n");
}
