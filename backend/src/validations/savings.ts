import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { amountField, dateField, noteField } from "./transaction";

const fields = {
  name: z
    .string({ error: "Vui lòng nhập tên mục tiêu." })
    .trim()
    .min(1, { error: "Vui lòng nhập tên mục tiêu." })
    .max(60, { error: "Tên mục tiêu tối đa 60 ký tự." }),
  targetAmount: amountField("Vui lòng nhập số tiền mục tiêu."),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Loại tiền tệ không được hỗ trợ." }),
  // Empty string = no deadline.
  deadline: z.union([z.literal("").transform(() => null), dateField]),
};

export const createGoalSchema = z.object(fields);

// Currency is fixed after creation: every contribution is recorded in it.
export const updateGoalSchema = createGoalSchema.omit({ currency: true });

export const contributionSchema = z.object({
  direction: z.enum(["deposit", "withdraw"], { error: "Loại không hợp lệ." }),
  amount: amountField("Vui lòng nhập số tiền."),
  date: dateField,
  note: noteField,
});
