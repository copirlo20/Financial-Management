import { getDocument, PasswordException } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Turns the text of a PDF statement back into rows and columns, so it goes through the same column
// mapping as an Excel file. A PDF has no cells: only pieces of text at positions on the page. Pieces on
// one baseline form a line; the columns are the vertical bands that the transaction lines (a date and an
// amount) fill, separated by empty space. Scanned statements carry no text and cannot be read this way.

export const MAX_PDF_PAGES = 200;

export class PdfReadError extends Error {
  constructor(readonly reason: "not-pdf" | "password" | "too-many-pages", options?: ErrorOptions) {
    super(reason, options);
  }
}

const DATE_LIKE = /(^|\s)\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}(\s|$)/;
const AMOUNT_LIKE = /^[(+-]?\d[\d.,\s]*\)?(\s*[A-Za-z₫$€£¥]{1,3})?$/;

type Piece = { text: string; x0: number; x1: number; y: number; size: number };
type Line = { page: number; y: number; size: number; cells: Piece[] };
type Band = { x0: number; x1: number };
type ColumnBand = Band & { extra: boolean };

async function readPieces(data: Uint8Array): Promise<Piece[][]> {
  const loading = getDocument({ data, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new PdfReadError("too-many-pages");
    const pages: Piece[][] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      // Text placed off the page is not shown, and coordinates far out would make the column count
      // (one slot per point of width) as large as the file asks for.
      const [left, bottom, right, top] = page.view;
      const content = await page.getTextContent();
      const pieces: Piece[] = [];
      for (const item of content.items) {
        const { str, transform, width } = item as TextItem;
        const text = str?.normalize("NFC").trim();
        if (!text) continue;
        // Horizontal text only: transform is [a, b, c, d, x, y] with d the font size.
        const [x, y] = [transform[4], transform[5]];
        if (!(x >= left && x <= right && y >= bottom && y <= top)) continue;
        const size = Math.abs(transform[3]) || 1;
        pieces.push({ text, x0: x, x1: Math.min(right, x + Math.max(0, width)), y, size });
      }
      pages.push(pieces);
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}

// Pieces on the same baseline, top to bottom; within a line, pieces closer than half a character apart
// are one cell (the words of one text), wider gaps separate cells.
function toLines(pages: Piece[][]): Line[] {
  const lines: Line[] = [];
  pages.forEach((pieces, page) => {
    const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x0 - b.x0);
    const pageLines: { y: number; size: number; pieces: Piece[] }[] = [];
    for (const piece of sorted) {
      // Sorted top to bottom, so a piece can only belong to the line started last.
      const line = pageLines.at(-1);
      if (line && line.y - piece.y <= Math.max(2, Math.min(line.size, piece.size) * 0.4)) {
        line.pieces.push(piece);
        line.size = Math.max(line.size, piece.size);
      } else {
        pageLines.push({ y: piece.y, size: piece.size, pieces: [piece] });
      }
    }
    for (const line of pageLines) {
      const cells: Piece[] = [];
      for (const piece of line.pieces.sort((a, b) => a.x0 - b.x0)) {
        const last = cells.at(-1);
        const gap = last ? piece.x0 - last.x1 : Infinity;
        if (last && gap < Math.max(piece.size, last.size) * 0.5) {
          last.text += gap > Math.min(piece.size, last.size) * 0.1 ? ` ${piece.text}` : piece.text;
          last.x1 = Math.max(last.x1, piece.x1);
        } else {
          cells.push({ ...piece });
        }
      }
      lines.push({ page, y: line.y, size: line.size, cells });
    }
  });
  return lines;
}

const isDateLine = (line: Line) => line.cells.some((cell) => DATE_LIKE.test(cell.text));
// A date and, in another cell, an amount: a statement line such as "Statement date: 19/10/2026" is not one.
const isTransactionLine = (line: Line) => isDateLine(line) && line.cells.some((cell) => AMOUNT_LIKE.test(cell.text));

// Merges overlapping spans into bands, left to right.
function mergeSpans(spans: Band[]): Band[] {
  const bands: Band[] = [];
  for (const span of [...spans].sort((a, b) => a.x0 - b.x0)) {
    const last = bands.at(-1);
    if (last && span.x0 <= last.x1) last.x1 = Math.max(last.x1, span.x1);
    else bands.push({ ...span });
  }
  return bands;
}

// The columns. Most come from the transaction lines: x positions covered by enough of them. A text that
// only a line or two spread across (a title, a total) does not join two columns that way. A cell outside
// every such band (a column that is rarely filled, such as money in on a card statement) gets a band of
// its own rather than being pushed into a neighbour; those bands are marked `extra`.
function findBands(lines: Line[]): ColumnBand[] {
  let table = lines.filter(isTransactionLine);
  if (table.length === 0) table = lines.filter((line) => line.cells.length >= 2);
  if (table.length === 0) table = lines;

  let min = Infinity;
  let max = -Infinity;
  for (const cell of table.flatMap((line) => line.cells)) {
    min = Math.min(min, Math.floor(cell.x0));
    max = Math.max(max, Math.ceil(cell.x1));
  }
  const coverage = new Array<number>(max - min + 1).fill(0);
  for (const line of table) {
    for (const cell of line.cells) {
      for (let x = Math.floor(cell.x0); x < Math.ceil(cell.x1); x++) coverage[x - min]++;
    }
  }
  const needed = Math.max(1, Math.ceil(table.length * 0.05));
  const strong: Band[] = [];
  coverage.forEach((count, index) => {
    const x = index + min;
    const last = strong.at(-1);
    if (count < needed) return;
    if (last && last.x1 === x) last.x1 = x + 1;
    else strong.push({ x0: x, x1: x + 1 });
  });

  const outside = lines.flatMap((line) => line.cells).filter((cell) => !strong.some((band) => overlap(cell, band) > 0));
  return [...strong.map((band) => ({ ...band, extra: false })), ...mergeSpans(outside).map((band) => ({ ...band, extra: true }))].sort(
    (a, b) => a.x0 - b.x0,
  );
}

const overlap = (cell: Band, band: Band) => Math.min(cell.x1, band.x1) - Math.max(cell.x0, band.x0);

// Each cell goes to the column it overlaps most. A cell that touches a column of the transactions belongs
// to it even when it overlaps an extra band more: a column name wider than the amounts under it (such as
// "Ghi nợ (USD)" over "20.50") must stay with them, not go to a band made by a heading block above.
function toRow(line: Line, bands: ColumnBand[]): (string | null)[] {
  const row: (string | null)[] = bands.map(() => null);
  for (const cell of line.cells) {
    const inTable = bands.some((band) => !band.extra && overlap(cell, band) > 0);
    let best = -1;
    bands.forEach((band, index) => {
      if (inTable && band.extra) return;
      if (best < 0 || overlap(cell, band) > overlap(cell, bands[best])) best = index;
    });
    row[best] = row[best] === null ? cell.text : `${row[best]} ${cell.text}`;
  }
  return row;
}

// A transaction whose description wraps continues on the next lines: close below it on the same page,
// with no date and no amount of their own. Those lines are joined to it, column by column, and the same
// goes for column names written on two lines.
function isContinuation(line: Line, previous: Line | undefined): boolean {
  if (!previous || previous.page !== line.page) return false;
  if (previous.y - line.y > Math.max(previous.size, line.size) * 1.6) return false;
  return line.cells.every((cell) => !DATE_LIKE.test(cell.text) && !AMOUNT_LIKE.test(cell.text));
}

// The text lines of the statement as rows of cells, top to bottom and page after page: everything up to
// the first transaction (the heading, where the column names are), then only lines with a date. What
// else follows (page headings repeated, totals, notes, page numbers) cannot be a transaction and would
// only show up as rows that failed. No text at all (a scan) gives no rows.
export async function parsePdf(buffer: Buffer): Promise<(string | null)[][]> {
  if (!buffer.subarray(0, 1024).includes("%PDF-")) throw new PdfReadError("not-pdf");
  let pages: Piece[][];
  try {
    pages = await readPieces(new Uint8Array(buffer));
  } catch (error) {
    if (error instanceof PasswordException) throw new PdfReadError("password", { cause: error });
    throw error;
  }
  const lines = toLines(pages);
  if (lines.length === 0) return [];

  const bands = findBands(lines);
  const rows: (string | null)[][] = [];
  let inTable = false;
  // The row that continuation lines are added to: in the heading the last one (column names written on
  // two lines), in the table the last transaction.
  let target: (string | null)[] | null = null;
  let previous: Line | undefined;
  for (const line of lines) {
    const row = toRow(line, bands);
    if (target && isContinuation(line, previous)) {
      const joined = target;
      row.forEach((text, index) => {
        if (text !== null) joined[index] = joined[index] === null ? text : `${joined[index]} ${text}`;
      });
    } else {
      inTable ||= isTransactionLine(line);
      const kept = !inTable || isDateLine(line);
      if (kept) rows.push(row);
      target = kept ? row : null;
    }
    previous = line;
  }
  return rows;
}
