import { z } from "zod";
import { AccountType } from "@fm/database";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";

const nameField = z
  .string({ error: "Vui lòng nhập tên tài khoản." })
  .trim()
  .min(1, { error: "Vui lòng nhập tên tài khoản." })
  .max(60, { error: "Tên tài khoản tối đa 60 ký tự." });

const typeField = z.enum(AccountType, { error: "Loại tài khoản không hợp lệ." });

// Kept as a string end to end (form -> Zod -> Decimal column) so money never passes through a float.
// 13 integer digits keeps sums of many accounts well inside Decimal(18, 2).
const balanceField = z
  .string({ error: "Vui lòng nhập số dư ban đầu." })
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(
    z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/, {
      error: "Số dư không hợp lệ. Chỉ nhập số, ví dụ 1500000 hoặc 120.50.",
    }),
  );

export const createAccountSchema = z.object({
  name: nameField,
  type: typeField,
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Loại tiền tệ không được hỗ trợ." }),
  initialBalance: balanceField,
});

// Currency is fixed after creation: every transaction of the account is recorded in it.
export const updateAccountSchema = createAccountSchema.omit({ currency: true });
