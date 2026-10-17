// The PDF account statement: its limits and the reasons an export is refused. The backend enforces them;
// the form on the transactions page checks the dates first and shows the same messages.
export const STATEMENT_MAX_DAYS = 1096; // three years
export const STATEMENT_MAX_ROWS = 3000;

// The backend answers a refused export with one of these codes as its message; the frontend shows the text
// (Vietnamese source, translated on display).
export const STATEMENT_ERRORS = {
  invalid: "Khoảng thời gian không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
  range: "Mỗi sao kê tối đa 3 năm. Hãy chọn khoảng thời gian ngắn hơn.",
  account: "Không tìm thấy tài khoản.",
  rows: "Khoảng thời gian này có quá nhiều giao dịch (tối đa 3.000). Hãy chọn khoảng ngắn hơn.",
  busy: "Bạn đã xuất nhiều sao kê trong một giờ qua. Hãy thử lại sau.",
  failed: "Không tạo được sao kê. Hãy thử lại.",
} as const;
export type StatementError = keyof typeof STATEMENT_ERRORS;

export function isStatementError(code: unknown): code is StatementError {
  return typeof code === "string" && Object.hasOwn(STATEMENT_ERRORS, code);
}

// Days from `from` to `to`, both "YYYY-MM-DD", counting both ends.
export function statementDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
