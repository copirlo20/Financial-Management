import { z } from "zod";
import { dateText } from "./common";

// String end to end so money never passes through a float; always positive, direction comes from the type.
export const amountField = (requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(
      z
        .string()
        .min(1, { error: requiredMessage })
        .regex(/^\d{1,13}(\.\d{1,2})?$/, { error: "Số tiền không hợp lệ. Chỉ nhập số, ví dụ 50000 hoặc 12.50." })
        .refine((value) => Number(value) > 0, { error: "Số tiền phải lớn hơn 0." }),
    );

export const dateField = z
  .string({ error: "Vui lòng chọn ngày." })
  .pipe(dateText)
  .pipe(z.iso.date({ error: "Ngày không hợp lệ." }))
  .refine((value) => value >= "2000-01-01" && value <= "2100-12-31", { error: "Ngày nằm ngoài khoảng cho phép." });

export const noteField = z
  .string()
  .trim()
  .max(200, { error: "Ghi chú tối đa 200 ký tự." })
  .transform((value) => value || null);

export const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"], { error: "Loại giao dịch không hợp lệ." }),
  accountId: z.uuid({ error: "Vui lòng chọn tài khoản." }),
  categoryId: z.uuid({ error: "Vui lòng chọn danh mục." }),
  amount: amountField("Vui lòng nhập số tiền."),
  date: dateField,
  note: noteField,
});

export const transferSchema = z
  .object({
    fromAccountId: z.uuid({ error: "Vui lòng chọn tài khoản nguồn." }),
    toAccountId: z.uuid({ error: "Vui lòng chọn tài khoản đích." }),
    amount: amountField("Vui lòng nhập số tiền."),
    // Only meaningful when the two accounts use different currencies.
    toAmount: z.union([
      z.string().trim().length(0).transform(() => null),
      amountField("Vui lòng nhập số tiền nhận."),
    ]),
    date: dateField,
    note: noteField,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    error: "Tài khoản đích phải khác tài khoản nguồn.",
    path: ["toAccountId"],
  });

const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const transactionFilterSchema = z.object({
  accountId: optional(z.uuid()),
  categoryId: optional(z.uuid()),
  type: optional(z.enum(["EXPENSE", "INCOME", "TRANSFER"])),
  from: optional(dateText.pipe(z.iso.date())),
  to: optional(dateText.pipe(z.iso.date())),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
