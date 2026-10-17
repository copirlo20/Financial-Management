"use client";

import { useActionState } from "react";
import type { ContributionFormState } from "@/app/actions/savings";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  action: (state: ContributionFormState, formData: FormData) => Promise<ContributionFormState>;
  currency: string;
  today: string;
};

export function ContributionForm({ action, currency, today }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { direction: "deposit", amount: "", date: today, note: "", ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã ghi nhận.")}</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="sc-direction">{t("Loại")}</Label>
        <NativeSelect
          id="sc-direction"
          name="direction"
          key={values.direction}
          defaultValue={values.direction}
          aria-invalid={Boolean(state?.errors?.direction)}
          aria-describedby="sc-direction-error"
        >
          <option value="deposit">{t("Nạp thêm")}</option>
          <option value="withdraw">{t("Rút ra")}</option>
        </NativeSelect>
        <FieldError id="sc-direction-error" messages={state?.errors?.direction} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sc-amount">{t("Số tiền ({0})", currency)}</Label>
        <Input
          id="sc-amount"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={values.amount}
          aria-invalid={Boolean(state?.errors?.amount)}
          aria-describedby="sc-amount-error"
        />
        <FieldError id="sc-amount-error" messages={state?.errors?.amount} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sc-date">{t("Ngày")}</Label>
        <Input
          id="sc-date"
          name="date"
          type="date"
          required
          defaultValue={values.date}
          aria-invalid={Boolean(state?.errors?.date)}
          aria-describedby="sc-date-error"
        />
        <FieldError id="sc-date-error" messages={state?.errors?.date} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sc-note">{t("Ghi chú")}</Label>
        <Input
          id="sc-note"
          name="note"
          maxLength={200}
          defaultValue={values.note}
          aria-invalid={Boolean(state?.errors?.note)}
          aria-describedby="sc-note-error"
        />
        <FieldError id="sc-note-error" messages={state?.errors?.note} />
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang lưu...") : t("Ghi nhận")}
      </Button>
    </form>
  );
}
