import ExcelJS from "exceljs";
import Papa from "papaparse";
import { ArchiveTooLargeError, checkXlsxArchive } from "./xlsx-guard";

export type Cell = string | number | Date | null;
export type StatementExtension = "csv" | "xlsx";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;
const MAX_COLUMNS = 50;

// Message is safe to show to the user.
export class StatementFileError extends Error {
  // message is a translatable template; args fill its {0}, {1}… placeholders.
  constructor(
    message: string,
    readonly args: (string | number)[] = [],
  ) {
    super(message);
  }
}

export function statementExtension(fileName: string): StatementExtension | null {
  const match = /\.(csv|xlsx)$/i.exec(fileName);
  return match ? (match[1].toLowerCase() as StatementExtension) : null;
}

// Vietnamese banks often export CSV as Windows-1258 instead of UTF-8.
function decodeText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1258").decode(buffer);
  }
}

function parseCsv(buffer: Buffer): Cell[][] {
  const result = Papa.parse<string[]>(decodeText(buffer), { skipEmptyLines: "greedy" });
  return result.data.map((row) => row.map((cell) => cell.trim() || null));
}

function normalizeExcelValue(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "boolean") return String(value);
  if ("result" in value) return normalizeExcelValue(value.result as ExcelJS.CellValue);
  if ("richText" in value) return value.richText.map((part) => part.text).join("").trim() || null;
  if ("text" in value) return String(value.text).trim() || null;
  return null;
}

async function parseXlsx(buffer: Buffer): Promise<Cell[][]> {
  try {
    checkXlsxArchive(buffer);
  } catch (error) {
    if (error instanceof ArchiveTooLargeError) {
      throw new StatementFileError("File Excel quá lớn khi giải nén. Hãy tách thành nhiều file nhỏ hơn hoặc lưu lại dưới dạng CSV.");
    }
    throw error;
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: Cell[][] = [];
  sheet.eachRow((row) => {
    // row.values is 1-based and sparse.
    const values = row.values as ExcelJS.CellValue[];
    const cells: Cell[] = [];
    for (let column = 1; column < values.length; column++) cells.push(normalizeExcelValue(values[column]));
    rows.push(cells);
  });
  return rows;
}

// Returns only non-empty rows; row numbers shown to the user count these rows, in file order.
export async function parseStatementFile(buffer: Buffer, extension: StatementExtension): Promise<Cell[][]> {
  let rows: Cell[][];
  try {
    rows = extension === "csv" ? parseCsv(buffer) : await parseXlsx(buffer);
  } catch (error) {
    if (error instanceof StatementFileError) throw error;
    throw new StatementFileError("Không đọc được file. Hãy kiểm tra file có đúng định dạng CSV hoặc Excel (.xlsx) không.");
  }

  rows = rows.map((row) => row.slice(0, MAX_COLUMNS)).filter((row) => row.some((cell) => cell !== null));
  if (rows.length === 0) throw new StatementFileError("File không có dữ liệu.");
  if (rows.length > MAX_ROWS) {
    throw new StatementFileError("File có {0} dòng, vượt giới hạn {1} dòng mỗi lần nhập.", [rows.length, MAX_ROWS]);
  }
  return rows;
}
