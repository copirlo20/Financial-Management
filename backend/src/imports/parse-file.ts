import ExcelJS from "exceljs";
import { MAX_PDF_PAGES, PdfReadError, parsePdf } from "./parse-pdf";
import { ArchiveTooLargeError, checkXlsxArchive } from "./xlsx-guard";

export type Cell = string | number | Date | null;
export type StatementExtension = "xlsx" | "pdf";

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

// A PDF whose text the code cannot get at: made of pictures (a scan, a photo of the statement), or built in
// a way pdf.js does not follow. The assistant reads the file itself, so it may still manage.
export class UnreadablePdfError extends StatementFileError {}

export function statementExtension(fileName: string): StatementExtension | null {
  const match = /\.(xlsx|pdf)$/i.exec(fileName);
  return match ? (match[1].toLowerCase() as StatementExtension) : null;
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
      throw new StatementFileError("File Excel quá lớn khi giải nén. Hãy tách thành nhiều file nhỏ hơn.");
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
    rows = extension === "pdf" ? await parsePdf(buffer) : await parseXlsx(buffer);
  } catch (error) {
    if (error instanceof StatementFileError) throw error;
    if (extension === "xlsx") throw new StatementFileError("Không đọc được file. Hãy kiểm tra file có đúng định dạng Excel (.xlsx) không.");
    if (error instanceof PdfReadError && error.reason === "password") {
      throw new StatementFileError("File PDF có mật khẩu. Hãy tải sao kê không đặt mật khẩu, hoặc mở file rồi in lại thành PDF không có mật khẩu.");
    }
    if (error instanceof PdfReadError && error.reason === "too-many-pages") {
      throw new StatementFileError("File PDF có hơn {0} trang. Hãy tải sao kê theo khoảng thời gian ngắn hơn.", [MAX_PDF_PAGES]);
    }
    const message = "Không đọc được file. Hãy kiểm tra file có đúng định dạng PDF không.";
    // Without the PDF marker it is no PDF at all, not even for the assistant.
    throw error instanceof PdfReadError ? new StatementFileError(message) : new UnreadablePdfError(message);
  }

  rows = rows.map((row) => row.slice(0, MAX_COLUMNS)).filter((row) => row.some((cell) => cell !== null));
  if (rows.length === 0 && extension === "pdf") {
    throw new UnreadablePdfError("File PDF không có chữ để đọc (có thể là bản scan hoặc ảnh chụp). Hãy tải sao kê PDF gốc từ ngân hàng.");
  }
  if (rows.length === 0) throw new StatementFileError("File không có dữ liệu.");
  if (rows.length > MAX_ROWS) {
    throw new StatementFileError("File có {0} dòng, vượt giới hạn {1} dòng mỗi lần nhập.", [rows.length, MAX_ROWS]);
  }
  return rows;
}
