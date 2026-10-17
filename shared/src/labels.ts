// Display names (Vietnamese source text, translated at render) for the values stored in the database's
// enum columns. The unions repeat the enums in database/prisma/schema.prisma so that the frontend can
// name them without depending on the database package.
export type AccountType = "CASH" | "BANK" | "E_WALLET" | "CREDIT_CARD" | "OTHER";
export type CategoryType = "EXPENSE" | "INCOME";
export type ImportStatus = "PENDING" | "PROCESSED" | "FAILED" | "ROLLED_BACK";
export type SavingsGoalStatus = "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Tiền mặt",
  BANK: "Tài khoản ngân hàng",
  E_WALLET: "Ví điện tử",
  CREDIT_CARD: "Thẻ tín dụng",
  OTHER: "Khác",
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Khoản chi",
  INCOME: "Khoản thu",
};

export const TRANSACTION_TYPE_LABELS = {
  EXPENSE: "Khoản chi",
  INCOME: "Khoản thu",
} as const;

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  PENDING: "Chờ xác nhận",
  PROCESSED: "Đã nhập",
  FAILED: "Lỗi",
  ROLLED_BACK: "Đã hoàn tác",
};

export const GOAL_STATUS_LABELS: Record<SavingsGoalStatus, string> = {
  IN_PROGRESS: "Đang tiết kiệm",
  COMPLETED: "Đã đạt mục tiêu",
  ARCHIVED: "Đã lưu trữ",
};
