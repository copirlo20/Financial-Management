import { fileRowCells, type RowError } from "@fm/shared/imports";
import type { Cell } from "./parse-file";

export type { RowError };

export type DateFormat = "DMY" | "MDY" | "YMD";
export type DecimalSeparator = "." | ",";

export type ColumnMapping = {
  headerRow: number; // 1-based row number of the header; data starts on the next row
  dateColumn: number;
  dateFormat: DateFormat;
  amountMode: "signed" | "split";
  amountColumn: number | null; // signed: negative = expense, positive = income
  debitColumn: number | null; // split: money out
  creditColumn: number | null; // split: money in
  descriptionColumn: number | null;
  decimalSeparator: DecimalSeparator;
};

export type ParsedRow = {
  rowNumber: number;
  date: string; // YYYY-MM-DD
  type: "EXPENSE" | "INCOME";
  amount: string; // positive decimal string
  description: string;
};

const ALIASES = {
  date: ["ngay", "date", "ngay gd", "ngay giao dich", "transaction date", "ngay hach toan", "posting date"],
  amount: ["so tien", "amount", "so tien gd", "so tien giao dich"],
  debit: ["no", "debit", "ghi no", "so tien ghi no", "phat sinh no", "rut", "chi", "withdrawal"],
  credit: ["co", "credit", "ghi co", "so tien ghi co", "phat sinh co", "gui", "thu", "deposit"],
  description: ["dien giai", "noi dung", "noi dung giao dich", "description", "narrative", "mo ta", "details", "remark"],
} as const;
type Field = keyof typeof ALIASES;

function normalizeHeader(cell: Cell): string {
  if (typeof cell !== "string") return "";
  return cell
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Longer alias matches win, so "so tien ghi no" goes to debit rather than the generic "so tien".
function aliasScore(header: string, field: Field): number {
  let best = 0;
  for (const alias of ALIASES[field]) {
    if (header === alias) best = Math.max(best, 100 + alias.length);
    else if (` ${header} `.includes(` ${alias} `)) best = Math.max(best, alias.length);
  }
  return best;
}

function bestColumn(headers: string[], field: Field): number | null {
  let best: number | null = null;
  let bestScore = 0;
  headers.forEach((header, index) => {
    const score = aliasScore(header, field);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

export function suggestMapping(table: Cell[][]): ColumnMapping {
  // The header is the row (within the first 30) where the most known column names are recognised.
  let headerIndex = 0;
  let bestHits = 0;
  table.slice(0, 30).forEach((row, index) => {
    const headers = row.map(normalizeHeader);
    const hits = (Object.keys(ALIASES) as Field[]).filter((field) => bestColumn(headers, field) !== null).length;
    if (hits > bestHits) {
      bestHits = hits;
      headerIndex = index;
    }
  });

  const headers = (table[headerIndex] ?? []).map(normalizeHeader);
  const debitColumn = bestColumn(headers, "debit");
  const creditColumn = bestColumn(headers, "credit");
  const split = debitColumn !== null && creditColumn !== null && debitColumn !== creditColumn;
  const dateColumn = bestColumn(headers, "date") ?? 0;
  const amountColumn = bestColumn(headers, "amount");

  const samples = table.slice(headerIndex + 1, headerIndex + 21);
  const dateSamples = samples.map((row) => row[dateColumn]).filter((cell) => typeof cell === "string");
  let dateFormat: DateFormat = "DMY";
  if (dateSamples.some((value) => /^\d{4}\D/.test(value))) dateFormat = "YMD";
  else if (dateSamples.some((value) => Number(value.split(/\D/)[1]) > 12)) dateFormat = "MDY";

  const amountColumns = split ? [debitColumn, creditColumn] : [amountColumn];
  const commaDecimal = samples.some((row) =>
    amountColumns.some((column) => {
      const cell = column === null ? null : row[column];
      return typeof cell === "string" && /,\d{1,2}$/.test(cell.trim());
    }),
  );

  return {
    headerRow: headerIndex + 1,
    dateColumn,
    dateFormat,
    amountMode: split ? "split" : "signed",
    amountColumn: split ? null : amountColumn,
    debitColumn: split ? debitColumn : null,
    creditColumn: split ? creditColumn : null,
    descriptionColumn: bestColumn(headers, "description"),
    decimalSeparator: commaDecimal ? "," : ".",
  };
}

type Amount = { negative: boolean; abs: string; zero: boolean };

function normalizeDecimal(text: string): Amount | null {
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(text)) return null;
  return { negative: false, abs: text, zero: Number(text) === 0 };
}

// null = empty cell, "invalid" = present but not a usable amount.
export function parseAmount(cell: Cell, decimalSeparator: DecimalSeparator): Amount | null | "invalid" {
  if (cell === null) return null;
  if (cell instanceof Date) return "invalid";
  if (typeof cell === "number") {
    const amount = normalizeDecimal(Math.abs(cell).toFixed(2));
    return amount ? { ...amount, negative: cell < 0 } : "invalid";
  }

  // Drop currency names/symbols and spaces: "1.500.000 VND", "₫ 50,000", "(1,200.50)".
  let text = cell.replace(/[^\d.,()+-]/g, "");
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/^[+-]/.test(text)) {
    negative = negative || text[0] === "-";
    text = text.slice(1);
  }
  const thousands = decimalSeparator === "." ? "," : ".";
  text = text.split(thousands).join("");
  if (decimalSeparator === ",") text = text.replace(",", ".");
  // No rounding here: "1.500" read with the wrong separator must fail loudly, not become 1.50.

  const amount = normalizeDecimal(text);
  return amount ? { ...amount, negative } : "invalid";
}

export function parseDate(cell: Cell, format: DateFormat): string | null {
  let year: number, month: number, day: number;
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    [year, month, day] = [cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate()];
  } else if (typeof cell === "string") {
    // Ignore a trailing time part: "05/10/2026 14:32:01".
    const parts = cell.trim().split(/[\sT]/)[0].split(/[/.-]/);
    if (parts.length !== 3 || parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
    const [a, b, c] = parts.map(Number);
    if (format === "YMD") [year, month, day] = [a, b, c];
    else if (format === "DMY") [year, month, day] = [c, b, a];
    else [year, month, day] = [c, a, b];
    if (year < 100) year += 2000;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real || year < 2000 || year > 2100) return null;
  return date.toISOString().slice(0, 10);
}

export function buildRows(table: Cell[][], mapping: ColumnMapping): { rows: ParsedRow[]; errors: RowError[] } {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const header = mapping.headerRow > 0 ? table[mapping.headerRow - 1] : [];

  for (let index = mapping.headerRow; index < table.length; index++) {
    const cells = table[index];
    const rowNumber = index + 1;
    // The whole row goes with its error, so the person can see what the file held there.
    const fail = (message: string) => errors.push({ rowNumber, message, cells: fileRowCells(cells, header) });

    const date = parseDate(cells[mapping.dateColumn] ?? null, mapping.dateFormat);
    if (!date) {
      fail("Ngày không hợp lệ hoặc không đúng định dạng đã chọn.");
      continue;
    }

    let type: ParsedRow["type"];
    let amount: string;
    if (mapping.amountMode === "signed") {
      const parsed = parseAmount(cells[mapping.amountColumn ?? -1] ?? null, mapping.decimalSeparator);
      if (parsed === "invalid" || parsed === null || parsed.zero) {
        fail(parsed === "invalid" ? "Số tiền không hợp lệ." : "Thiếu số tiền hoặc số tiền bằng 0.");
        continue;
      }
      type = parsed.negative ? "EXPENSE" : "INCOME";
      amount = parsed.abs;
    } else {
      const debit = parseAmount(cells[mapping.debitColumn ?? -1] ?? null, mapping.decimalSeparator);
      const credit = parseAmount(cells[mapping.creditColumn ?? -1] ?? null, mapping.decimalSeparator);
      if (debit === "invalid" || credit === "invalid") {
        fail("Số tiền không hợp lệ.");
        continue;
      }
      const hasDebit = debit !== null && !debit.zero;
      const hasCredit = credit !== null && !credit.zero;
      if (hasDebit === hasCredit) {
        fail(hasDebit ? "Dòng có cả số tiền chi và số tiền thu." : "Thiếu số tiền hoặc số tiền bằng 0.");
        continue;
      }
      type = hasDebit ? "EXPENSE" : "INCOME";
      amount = (hasDebit ? debit : credit)!.abs;
    }

    const rawDescription = mapping.descriptionColumn === null ? null : (cells[mapping.descriptionColumn] ?? null);
    const description = (rawDescription === null || rawDescription instanceof Date ? "" : String(rawDescription))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    rows.push({ rowNumber, date, type, amount, description });
  }

  return { rows, errors };
}
