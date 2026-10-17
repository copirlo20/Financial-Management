import ExcelJS from "exceljs";

// Header names are ones suggestMapping() recognises, so a filled-in template needs no manual column mapping.
const HEADERS = ["Ngày giao dịch", "Diễn giải", "Số tiền"] as const;

// Negative = money out, positive = money in.
const SAMPLE_ROWS: { date: [year: number, month: number, day: number]; description: string; amount: number }[] = [
  { date: [2026, 10, 5], description: "Ví dụ: Cà phê sáng", amount: -45000 },
  { date: [2026, 10, 6], description: "Ví dụ: Lương tháng 10", amount: 20000000 },
  { date: [2026, 10, 7], description: "Ví dụ: Tiền điện", amount: -1250000.5 },
];

const pad = (value: number) => String(value).padStart(2, "0");

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsvTemplate(): Buffer {
  const lines = [
    HEADERS.join(","),
    ...SAMPLE_ROWS.map(({ date: [year, month, day], description, amount }) =>
      [`${pad(day)}/${pad(month)}/${year}`, csvField(description), String(amount)].join(","),
    ),
  ];
  // The BOM makes Excel open the file as UTF-8 instead of mangling Vietnamese characters.
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}

export async function buildXlsxTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sao kê");
  sheet.columns = [
    { header: HEADERS[0], width: 18, style: { numFmt: "dd/mm/yyyy" } },
    { header: HEADERS[1], width: 40 },
    { header: HEADERS[2], width: 18, style: { numFmt: "#,##0.00" } },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const { date: [year, month, day], description, amount } of SAMPLE_ROWS) {
    sheet.addRow([new Date(Date.UTC(year, month - 1, day)), description, amount]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
