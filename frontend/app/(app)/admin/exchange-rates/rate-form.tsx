"use client";

import { useActionState } from "react";
import { setManualRate } from "@/app/actions/admin-exchange-rates";
import { DateInput } from "@/components/date-input";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { currencies: string[]; baseCurrency: string; today: string };

export function RateForm({ currencies, baseCurrency, today }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setManualRate, undefined);
  const values = { quoteCurrency: currencies[0], date: today, rate: "", ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("Đã lưu tỷ giá.")}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="xr-currency">{t("Tiền tệ")}</Label>
        <NativeSelect
          id="xr-currency"
          name="quoteCurrency"
          key={values.quoteCurrency}
          defaultValue={values.quoteCurrency}
          aria-invalid={Boolean(state?.errors?.quoteCurrency)}
          aria-describedby="xr-currency-error"
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="xr-currency-error" messages={state?.errors?.quoteCurrency} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="xr-date">{t("Ngày")}</Label>
        <DateInput
          id="xr-date"
          name="date"
          required
          defaultValue={values.date}
          aria-invalid={Boolean(state?.errors?.date)}
          aria-describedby="xr-date-error"
        />
        <FieldError id="xr-date-error" messages={state?.errors?.date} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="xr-rate">{t("Tỷ giá: 1 {0} bằng bao nhiêu?", baseCurrency)}</Label>
        <Input
          id="xr-rate"
          name="rate"
          required
          inputMode="decimal"
          placeholder={t("Ví dụ: 25900")}
          defaultValue={values.rate}
          aria-invalid={Boolean(state?.errors?.rate)}
          aria-describedby="xr-rate-hint xr-rate-error"
        />
        <p id="xr-rate-hint" className="text-xs text-muted-foreground">
          {t("Tỷ giá nhập tay không bị cập nhật tự động ghi đè. Giao dịch đã ghi giữ nguyên tỷ giá lúc ghi.")}
        </p>
        <FieldError id="xr-rate-error" messages={state?.errors?.rate} />
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang lưu...") : t("Lưu tỷ giá")}
      </Button>
    </form>
  );
}
