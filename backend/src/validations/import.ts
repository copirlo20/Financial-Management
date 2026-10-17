import { z } from "zod";

const column = z.coerce
  .number({ error: "Vui lòng chọn cột." })
  .int()
  .min(0)
  .max(49, { error: "Cột không hợp lệ." });

// Empty select value means "not used".
const optionalColumn = z.preprocess((value) => (value === "" ? null : value), column.nullable());

const expenseCategoryId = z.uuid({ error: "Vui lòng chọn danh mục cho khoản chi." });
const incomeCategoryId = z.uuid({ error: "Vui lòng chọn danh mục cho khoản thu." });

// Confirming a PDF import: the rows were already read by the assistant, only the default categories are chosen.
export const documentConfirmSchema = z.object({ expenseCategoryId, incomeCategoryId });

export const mappingSchema = z
  .object({
    headerRow: z.coerce
      .number({ error: "Dòng tiêu đề không hợp lệ." })
      .int({ error: "Dòng tiêu đề không hợp lệ." })
      .min(0, { error: "Dòng tiêu đề không hợp lệ." })
      .max(1000, { error: "Dòng tiêu đề không hợp lệ." }),
    dateColumn: z.preprocess((value) => (value === "" ? undefined : value), column),
    dateFormat: z.enum(["DMY", "MDY", "YMD"], { error: "Định dạng ngày không hợp lệ." }),
    amountMode: z.enum(["signed", "split"], { error: "Kiểu cột số tiền không hợp lệ." }),
    amountColumn: optionalColumn,
    debitColumn: optionalColumn,
    creditColumn: optionalColumn,
    descriptionColumn: optionalColumn,
    decimalSeparator: z.enum([".", ","], { error: "Dấu thập phân không hợp lệ." }),
    expenseCategoryId,
    incomeCategoryId,
  })
  .superRefine((data, ctx) => {
    if (data.amountMode === "signed") {
      if (data.amountColumn === null) {
        ctx.addIssue({ code: "custom", path: ["amountColumn"], message: "Vui lòng chọn cột số tiền." });
      }
      return;
    }
    if (data.debitColumn === null) {
      ctx.addIssue({ code: "custom", path: ["debitColumn"], message: "Vui lòng chọn cột tiền ra." });
    }
    if (data.creditColumn === null) {
      ctx.addIssue({ code: "custom", path: ["creditColumn"], message: "Vui lòng chọn cột tiền vào." });
    }
    if (data.debitColumn !== null && data.debitColumn === data.creditColumn) {
      ctx.addIssue({ code: "custom", path: ["creditColumn"], message: "Cột tiền vào phải khác cột tiền ra." });
    }
  });
