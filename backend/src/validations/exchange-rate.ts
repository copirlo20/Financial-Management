import { z } from "zod";
import { QUOTE_CURRENCIES } from "@fm/shared/rates";
import { dateField } from "./transaction";

export const manualRateSchema = z.object({
  quoteCurrency: z
    .string()
    .refine((value) => (QUOTE_CURRENCIES as readonly string[]).includes(value), { error: "Loại tiền tệ không được hỗ trợ." }),
  date: dateField,
  // Matches the Decimal(18, 6) column; string end to end so the rate never passes through a float.
  rate: z
    .string({ error: "Vui lòng nhập tỷ giá." })
    .trim()
    .min(1, { error: "Vui lòng nhập tỷ giá." })
    .regex(/^\d{1,12}(\.\d{1,6})?$/, { error: "Tỷ giá không hợp lệ. Chỉ nhập số, tối đa 6 chữ số thập phân." })
    .refine((value) => Number(value) > 0, { error: "Tỷ giá phải lớn hơn 0." }),
});
