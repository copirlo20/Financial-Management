import { z } from "zod";
import { amountField } from "./transaction";

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Tháng không hợp lệ." })
  .refine((value) => value >= "2000-01" && value <= "2100-12", { error: "Tháng nằm ngoài khoảng cho phép." });

const limitField = amountField("Vui lòng nhập hạn mức.");

export const createBudgetSchema = z.object({
  month: monthSchema,
  // Empty string = one budget for all spending in the month.
  categoryId: z
    .string()
    .refine((value) => value === "" || z.uuid().safeParse(value).success, { error: "Danh mục không hợp lệ." })
    .transform((value) => value || null),
  amountLimit: limitField,
});

export const updateBudgetSchema = z.object({ amountLimit: limitField });
