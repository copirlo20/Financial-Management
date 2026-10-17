import { z } from "zod";
import { prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { formText, type FormState } from "@fm/shared/form-state";
import { RATE_BASE } from "@fm/shared/rates";
import { requireAdmin } from "../auth/current-user";
import { recomputeConversions } from "../exchange";
import { idSchema } from "../validations/common";
import { manualRateSchema } from "../validations/exchange-rate";

export type ManualRateFormState = FormState<"quoteCurrency" | "date" | "rate">;

// Sets (or replaces) the rate for one currency on one day. Existing transaction snapshots keep the rate
// they were recorded with; only transactions that had no rate at all are filled in.
export async function setManualRate(_prev: ManualRateFormState, formData: FormData): Promise<ManualRateFormState> {
  await requireAdmin();

  const values = {
    quoteCurrency: formText(formData, "quoteCurrency"),
    date: formText(formData, "date"),
    rate: formText(formData, "rate"),
  };
  const parsed = manualRateSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { quoteCurrency, rate } = parsed.data;
  const date = isoDateToDate(parsed.data.date);

  await prisma.$transaction(async (tx) => {
    await tx.exchangeRate.upsert({
      where: { baseCurrency_quoteCurrency_date: { baseCurrency: RATE_BASE, quoteCurrency, date } },
      create: { baseCurrency: RATE_BASE, quoteCurrency, date, rate, isManual: true },
      update: { rate, isManual: true, createdAt: new Date() },
    });
    await recomputeConversions(tx, { onlyMissing: true });
  });

  return { success: true };
}

// Removing a manual rate lets the next automatic update supply that day's rate again.
export async function deleteManualRate(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.exchangeRate.deleteMany({ where: { id: id.data, isManual: true } });
}
