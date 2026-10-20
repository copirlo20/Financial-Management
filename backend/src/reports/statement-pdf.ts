import { fileURLToPath } from "node:url";
import type { Prisma } from "@fm/database";
import { formatDate, formatDay, isoDateToText } from "@fm/shared/dates";
import PDFDocument from "pdfkit";
import type { Statement, StatementRow } from "./statement";

// Draws a Statement as an A4 PDF laid out like a bank's account statement: the holder and the period at
// the top, a boxed summary, then the opening balance and every transaction with its debit or credit and
// the balance after it. The labels are bilingual (Vietnamese, with the English below in italics), as on
// Vietnamese bank statements, so one file serves both interface languages; category names follow the
// user's language.

const FONTS = {
  regular: fontFile("NotoSans-Regular.ttf"),
  bold: fontFile("NotoSans-Bold.ttf"),
  italic: fontFile("NotoSans-Italic.ttf"),
};
// Noto Sans covers every Vietnamese letter; the fonts PDF readers bring with them do not.
function fontFile(name: string): string {
  return fileURLToPath(new URL(`../../assets/fonts/${name}`, import.meta.url));
}

const PAGE_HEIGHT = 841.89;
const LEFT = 36;
const RIGHT = 559.28;
const WIDTH = RIGHT - LEFT;
const TOP = 36;
// Rows stop here; below are the end-of-statement line and the footer.
const CONTENT_BOTTOM = PAGE_HEIGHT - 84;

const INK = "#18181b";
const MUTED = "#52525b";
const BRAND = "#6d28d9";
const BRAND_LIGHT = "#a78bfa";
const BRAND_DARK = "#2e1065";
const RULE = "#3f3f46";
const HAIRLINE = "#e4e4e7";
const BAR = "#e4e4e7";

type Doc = PDFKit.PDFDocument;
type TextOptions = PDFKit.Mixins.TextOptions;
type Column = { vi: string; en: string; width: number; align: "left" | "right" };

// Shaping without "ccmp": Noto Sans would split letters with a dot below (ạ, ị, ụ…) into the letter and a
// dot that stands for no character, and pdfkit would then write a character map that makes the text copy
// and search as gibberish from that point on. With the text in composed form (NFC) the font's ready-made
// letters are used instead. pdfkit hands the features to fontkit, which takes this object form; the type
// only knows the list form.
const SHAPING = { ccmp: false } as unknown as TextOptions["features"];

// Applies SHAPING and NFC to everything this document measures or writes.
function keepLettersWhole(doc: Doc) {
  const text = doc.text.bind(doc);
  const widthOf = doc.widthOfString.bind(doc);
  const heightOf = doc.heightOfString.bind(doc);
  const shaped = (options?: TextOptions): TextOptions => ({ ...options, features: SHAPING });
  doc.text = ((value: string, x?: number | TextOptions, y?: number, options?: TextOptions) =>
    typeof x === "number"
      ? text(value.normalize("NFC"), x, y, shaped(options))
      : text(value.normalize("NFC"), shaped(typeof x === "object" ? x : options))) as Doc["text"];
  doc.widthOfString = (value, options) => widthOf(value.normalize("NFC"), shaped(options));
  doc.heightOfString = (value, options) => heightOf(value.normalize("NFC"), shaped(options));
}

const digitsCache = new Map<string, number>();
function digitsOf(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

// 1,250,000 / 1,250,000.50: grouped with commas, as bank statements print amounts.
function grouped(value: Prisma.Decimal, digits: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    value.toFixed(digits) as Intl.StringNumericLiteral,
  );
}

// Shortens a one-line value with "…" so it fits `width` in the current font.
function fit(doc: Doc, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function drawBrand(doc: Doc) {
  doc.font("bold").fontSize(15);
  doc.fillColor(BRAND).text("FINANCIAL", LEFT, TOP + 4, { continued: true, lineBreak: false });
  doc.fillColor(BRAND_DARK).text("MANAGEMENT", { lineBreak: false });
  const x = LEFT + doc.widthOfString("FINANCIALMANAGEMENT") + 18;
  const y = TOP + 14;
  // Two overlapping diamonds, after the bank-logo shape of the sample.
  doc.polygon([x, y - 11], [x + 11, y], [x, y + 11], [x - 11, y]).fill(BRAND);
  doc.polygon([x + 10, y - 8], [x + 18, y], [x + 10, y + 8], [x + 2, y]).fill(BRAND_LIGHT);
}

function drawTitle(doc: Doc) {
  const x = 300;
  const width = RIGHT - x;
  doc.fillColor(INK).font("bold").fontSize(11.5).text("SAO KÊ TÀI KHOẢN", x, TOP + 2, { width, align: "center" });
  doc.fontSize(10.5).text("Account Statement", x, TOP + 18, { width, align: "center" });
}

// A label with its English below, and the value on the right of the same column.
function drawField(doc: Doc, x: number, y: number, width: number, vi: string, en: string, value: string) {
  doc.fillColor(INK).font("bold").fontSize(9.5).text(vi, x, y, { lineBreak: false });
  const labelWidth = doc.widthOfString(vi) + 12;
  doc.font("italic").fontSize(7.5).fillColor(MUTED).text(en, x, y + 12, { lineBreak: false });
  doc.font("bold").fontSize(9.5).fillColor(INK);
  doc.text(fit(doc, value, width - labelWidth), x + labelWidth, y, { width: width - labelWidth, align: "right", lineBreak: false });
}

function drawHolder(doc: Doc, s: Statement): number {
  const y = TOP + 56;
  drawField(doc, LEFT, y, 248, "Chủ tài khoản:", "Account holder", s.holder.name.toLocaleUpperCase("vi"));
  drawField(doc, LEFT, y + 30, 248, "Email:", "Email", s.holder.email);
  const x = 314;
  const width = RIGHT - x;
  drawField(doc, x, y, width, "Ngày sao kê:", "Statement date", formatDay(s.createdAt));
  drawField(doc, x, y + 30, width, "Kỳ sao kê:", "Statement period", `${isoDateToText(s.from)} - ${isoDateToText(s.to)}`);
  drawField(doc, x, y + 60, width, "Tài khoản:", "Account", s.account ? s.account.name : "Tất cả tài khoản");
  drawField(doc, x, y + 90, width, "Loại tiền:", "Currency", s.currency);
  return y + 124;
}

function drawSummary(doc: Doc, s: Statement, top: number): number {
  doc.fillColor(INK).font("bold").fontSize(9).text("1. Tóm tắt sao kê trong kỳ (chi tiết mục A) ", LEFT, top, { continued: true, lineBreak: false });
  doc.font("italic").fontSize(7.5).fillColor(MUTED).text("Statement Summary (Details in Section A)", { lineBreak: false });

  const digits = digitsOf(s.currency);
  const cells = [
    { vi: `Số dư đầu kỳ (${s.currency})`, en: "Opening Balance", value: grouped(s.opening, digits) },
    { vi: `Tổng ghi nợ trong kỳ (${s.currency})`, en: "Total Debit in Period", value: grouped(s.debit, digits) },
    { vi: `Tổng ghi có trong kỳ (${s.currency})`, en: "Total Credit in Period", value: grouped(s.credit, digits) },
    { vi: `Số dư cuối kỳ (${s.currency})`, en: "Closing Balance", value: grouped(s.closing, digits) },
    { vi: "Số giao dịch", en: "Transactions", value: String(s.rows.length) },
  ];
  const y = top + 16;
  const headHeight = 38;
  const valueHeight = 20;
  const cellWidth = WIDTH / cells.length;
  cells.forEach((cell, index) => {
    const x = LEFT + index * cellWidth;
    doc.fillColor(INK).font("bold").fontSize(7.5).text(cell.vi, x + 4, y + 4, { width: cellWidth - 8, align: "center", height: 24 });
    doc.font("italic").fontSize(6.5).fillColor(MUTED).text(cell.en, x + 4, y + headHeight - 11, { width: cellWidth - 8, align: "center", lineBreak: false });
    doc.font("bold").fontSize(10).fillColor(INK);
    doc.text(fit(doc, cell.value, cellWidth - 8), x + 4, y + headHeight + 5, { width: cellWidth - 8, align: "center", lineBreak: false });
  });
  doc.lineWidth(0.7).strokeColor(RULE);
  doc.rect(LEFT, y, WIDTH, headHeight + valueHeight).stroke();
  doc.moveTo(LEFT, y + headHeight).lineTo(RIGHT, y + headHeight).stroke();
  for (let index = 1; index < cells.length; index++) {
    const x = LEFT + index * cellWidth;
    doc.moveTo(x, y).lineTo(x, y + headHeight + valueHeight).stroke();
  }
  return y + headHeight + valueHeight + 16;
}

// The columns of the details table, in this order: the money columns on the right, as bank statements
// print them, and the description, which takes the width that is left, before them.
const DESCRIPTION = 2;
const DEBIT = 3;
const CREDIT = 4;
const BALANCE = 5;

function columnsFor(s: Statement): Column[] {
  const columns: Column[] = [
    { vi: "Ngày giao dịch", en: "Transaction date", width: 62, align: "left" },
    { vi: "Ngày ghi nhận", en: "Recorded date", width: 62, align: "left" },
    { vi: "Diễn giải giao dịch", en: "Transaction description", width: 0, align: "left" },
    { vi: `Ghi nợ (${s.currency})`, en: "Debit", width: 76, align: "right" },
    { vi: `Ghi có (${s.currency})`, en: "Credit", width: 76, align: "right" },
    { vi: `Số dư (${s.currency})`, en: "Balance", width: 84, align: "right" },
  ];
  columns[DESCRIPTION].width = WIDTH - columns.reduce((sum, column) => sum + column.width, 0);
  return columns;
}

// The description of a row; with all accounts, followed by the account and, when the account is in another
// currency, the amount as it was recorded there.
function describe(row: StatementRow, s: Statement): string {
  const original = row.currency === s.currency ? null : `${grouped(row.amount, digitsOf(row.currency))} ${row.currency}`;
  const extra = [row.accountName, original].filter(Boolean).join(", ");
  return extra ? `${row.description} (${extra})` : row.description;
}

function columnX(columns: Column[], index: number): number {
  return LEFT + columns.slice(0, index).reduce((sum, column) => sum + column.width, 0);
}

function drawSectionBar(doc: Doc, top: number, continued: boolean): number {
  doc.rect(LEFT, top, WIDTH, 17).fill(BAR);
  doc.fillColor(INK).font("bold").fontSize(10).text(continued ? "A. Thông tin chi tiết (tiếp theo) " : "A. Thông tin chi tiết ", LEFT + 2, top + 2, { continued: true, lineBreak: false });
  doc.font("italic").fontSize(8).fillColor(MUTED).text(continued ? "Statement details (continued)" : "Statement details", { lineBreak: false });
  return top + 23;
}

function drawColumnHeads(doc: Doc, columns: Column[], top: number): number {
  columns.forEach((column, index) => {
    const x = columnX(columns, index);
    const padding = column.align === "right" ? { x: x, width: column.width - 6 } : { x: x, width: column.width - 4 };
    doc.fillColor(INK).font("bold").fontSize(7.5).text(column.vi, padding.x, top, { width: padding.width, align: column.align, lineBreak: false });
    doc.font("italic").fontSize(7).fillColor(MUTED).text(column.en, padding.x, top + 11, { width: padding.width, align: column.align, lineBreak: false });
  });
  const y = top + 24;
  doc.lineWidth(0.6).strokeColor(RULE).moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  return y;
}

// The details table: a first line with the opening balance, then every transaction with the balance after
// it, as a bank statement runs; the last balance is the closing balance.
function drawRows(doc: Doc, s: Statement, top: number): number {
  const columns = columnsFor(s);
  const digits = digitsOf(s.currency);
  let y = drawColumnHeads(doc, columns, drawSectionBar(doc, top, false));
  const descriptionWidth = columns[DESCRIPTION].width - 4;

  // One text per column, "" for an empty one. The description wraps; the other columns stay on one line.
  const drawLine = (cells: string[], font: "regular" | "bold") => {
    doc.font(font).fontSize(8);
    const height = Math.max(doc.heightOfString(cells[DESCRIPTION], { width: descriptionWidth }), 11) + 12;
    if (y + height > CONTENT_BOTTOM) {
      doc.addPage();
      y = drawColumnHeads(doc, columns, drawSectionBar(doc, TOP, true));
      doc.font(font).fontSize(8);
    }
    doc.fillColor(INK);
    cells.forEach((text, index) => {
      if (!text) return;
      const column = columns[index];
      if (index === DESCRIPTION) {
        doc.text(text, columnX(columns, index), y + 6, { width: descriptionWidth });
        return;
      }
      const width = column.width - (column.align === "right" ? 6 : 4);
      doc.text(fit(doc, text, width), columnX(columns, index), y + 6, { width, align: column.align, lineBreak: false });
    });
    y += height;
    doc.lineWidth(0.4).strokeColor(HAIRLINE).moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  };

  drawLine([isoDateToText(s.from), "", "Số dư đầu kỳ (Opening balance)", "", "", grouped(s.opening, digits)], "bold");
  if (s.rows.length === 0) {
    doc.fillColor(MUTED).font("italic").fontSize(8.5);
    doc.text("Không có giao dịch nào trong kỳ này. No transactions in this period.", LEFT, y + 10, { width: WIDTH, align: "center" });
    y += 32;
  }
  for (const row of s.rows) {
    drawLine(
      [
        formatDate(row.date),
        formatDay(row.recordedAt),
        describe(row, s),
        row.debit ? grouped(row.debit, digits) : "",
        row.credit ? grouped(row.credit, digits) : "",
        grouped(row.balance, digits),
      ],
      "regular",
    );
  }
  doc.lineWidth(0.6).strokeColor(RULE).moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  return y;
}

function notesFor(s: Statement): string[] {
  const notes: string[] = [];
  if (s.account) {
    notes.push(
      "Ghi nợ là tiền ra khỏi tài khoản (khoản chi, chuyển đi); ghi có là tiền vào tài khoản (khoản thu, nhận chuyển khoản). " +
        "Debit is money leaving the account (expenses, transfers out); credit is money entering it (income, transfers in).",
    );
  } else {
    notes.push(
      `Số liệu được quy về ${s.currency}: mỗi giao dịch theo tỷ giá tại ngày giao dịch, số dư ban đầu của các ví theo tỷ giá ngày ${isoDateToText(s.from)}. ` +
        "Chuyển khoản giữa các ví của bạn xuất hiện ở cả hai phía. " +
        `Amounts are in ${s.currency}: each transaction at the rate of its date, the accounts' opening amounts at the rate of ${isoDateToText(s.from)}. ` +
        "Transfers between your own accounts appear on both sides.",
    );
  }
  if (s.unconverted > 0) {
    notes.push(
      `${s.unconverted} giao dịch chưa có tỷ giá nên chưa được tính vào số dư và các tổng. ` +
        `${s.unconverted} transaction(s) without an exchange rate are left out of the balances and totals.`,
    );
  }
  if (s.missingRates.length > 0) {
    notes.push(
      `Chưa có tỷ giá cho số dư ban đầu của các ví ${s.missingRates.join(", ")}; phần này chưa được tính. ` +
        `No exchange rate for the opening amounts of the ${s.missingRates.join(", ")} accounts; they are left out.`,
    );
  }
  return notes;
}

function drawTotals(doc: Doc, s: Statement, top: number) {
  const digits = digitsOf(s.currency);
  const columns = columnsFor(s);
  const notes = notesFor(s);
  doc.font("italic").fontSize(7.5);
  const notesHeight = notes.reduce((sum, note) => sum + doc.heightOfString(note, { width: WIDTH }) + 4, 0);
  let y = top + 10;
  if (y + 72 + notesHeight > CONTENT_BOTTOM) {
    doc.addPage();
    y = TOP;
  }

  // A total, its value under the column it sums.
  const totalLine = (vi: string, en: string, value: string, column: number) => {
    doc.fillColor(INK).font("bold").fontSize(10).text(`${vi} `, LEFT, y, { continued: true, lineBreak: false });
    doc.font("italic").fontSize(7.5).fillColor(MUTED).text(en, { lineBreak: false });
    doc.font("bold").fontSize(9).fillColor(INK);
    const width = columns[column].width - 6;
    doc.text(value, columnX(columns, column), y + 1, { width, align: "right", lineBreak: false });
    y += 18;
  };
  totalLine("Tổng ghi nợ trong kỳ", "Total Debit in Period:", grouped(s.debit, digits), DEBIT);
  doc.lineWidth(0.5).strokeColor(RULE).moveTo(LEFT, y - 3).lineTo(RIGHT, y - 3).stroke();
  y += 3;
  totalLine("Tổng ghi có trong kỳ", "Total Credit in Period:", grouped(s.credit, digits), CREDIT);
  doc.lineWidth(0.5).strokeColor(RULE).moveTo(LEFT, y - 3).lineTo(RIGHT, y - 3).stroke();
  y += 3;
  totalLine("Số dư cuối kỳ", "Closing Balance:", grouped(s.closing, digits), BALANCE);

  y += 4;
  doc.font("italic").fontSize(7.5).fillColor(MUTED);
  for (const note of notes) {
    doc.text(note, LEFT, y, { width: WIDTH });
    y += doc.heightOfString(note, { width: WIDTH }) + 4;
  }
}

// The end-of-statement line on the last page and the footer with page numbers on every page. Drawn after
// the content, with the bottom margin lifted so that writing there does not start a new page.
function drawFooters(doc: Doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let index = start; index < start + count; index++) {
    doc.switchToPage(index);
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (index === start + count - 1) {
      doc.fillColor(INK).font("bold").fontSize(8.5);
      const endVi = "Kết Thúc Sao Kê";
      const gap = "      ";
      doc.font("italic").fontSize(8.5);
      const endEn = "End Of Statement";
      const total = doc.widthOfString(endEn) + doc.font("bold").widthOfString(endVi + gap);
      const x = LEFT + (WIDTH - total) / 2;
      doc.text(endVi + gap, x, PAGE_HEIGHT - 76, { continued: true, lineBreak: false });
      doc.font("italic").text(endEn, { lineBreak: false });
    }
    doc.lineWidth(0.6).strokeColor(RULE).moveTo(LEFT - 4, PAGE_HEIGHT - 60).lineTo(RIGHT + 4, PAGE_HEIGHT - 60).stroke();
    doc.fillColor(INK).font("bold").fontSize(8.5);
    doc.text("Sao kê được tạo tự động từ dữ liệu bạn đã ghi trong Financial Management", LEFT, PAGE_HEIGHT - 52, { width: WIDTH - 60, align: "center", lineBreak: false });
    doc.font("italic").fontSize(7.5).fillColor(MUTED);
    doc.text("Generated automatically from the data you recorded in Financial Management", LEFT, PAGE_HEIGHT - 40, { width: WIDTH - 60, align: "center", lineBreak: false });
    doc.font("regular").fontSize(7.5).fillColor(MUTED).text("FM-ST", RIGHT - 50, PAGE_HEIGHT - 52, { width: 50, align: "right", lineBreak: false });
    doc.text(`${index - start + 1}/${count}`, RIGHT - 50, PAGE_HEIGHT - 41, { width: 50, align: "right", lineBreak: false });
    doc.page.margins.bottom = margin;
  }
}

export function renderStatementPdf(s: Statement): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: TOP, left: LEFT, right: LEFT, bottom: 60 },
    bufferPages: true,
    info: {
      Title: `Sao kê tài khoản ${isoDateToText(s.from)} - ${isoDateToText(s.to)}`,
      Author: s.holder.name,
      Creator: "Financial Management",
      Producer: "Financial Management",
    },
  });
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, file);
  keepLettersWhole(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawBrand(doc);
  drawTitle(doc);
  const afterHolder = drawHolder(doc, s);
  const afterSummary = drawSummary(doc, s, afterHolder);
  const afterRows = drawRows(doc, s, afterSummary);
  drawTotals(doc, s, afterRows);
  drawFooters(doc);
  doc.end();
  return finished;
}
