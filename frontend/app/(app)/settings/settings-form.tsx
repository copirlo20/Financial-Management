"use client";

import { useActionState } from "react";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { LOCALES, LOCALE_LABELS } from "@fm/shared/i18n/config";
import { updateSettings } from "@/app/actions/settings";
import { FieldError } from "@/components/field-error";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { defaults: { name: string; language: string; defaultCurrency: string } };

export function SettingsForm({ defaults }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateSettings, undefined);
  const values = { ...defaults, ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(state.message)}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã lưu cài đặt.")}</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="st-name">{t("Họ tên")}</Label>
        <Input
          id="st-name"
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          defaultValue={values.name}
          aria-invalid={Boolean(state?.errors?.name)}
          aria-describedby="st-name-error"
        />
        <FieldError id="st-name-error" messages={state?.errors?.name} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="st-language">{t("Ngôn ngữ")}</Label>
        <NativeSelect
          id="st-language"
          name="language"
          key={values.language}
          defaultValue={values.language}
          aria-invalid={Boolean(state?.errors?.language)}
          aria-describedby="st-language-error"
        >
          {LOCALES.map((language) => (
            <option key={language} value={language}>
              {LOCALE_LABELS[language]}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="st-language-error" messages={state?.errors?.language} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="st-currency">{t("Tiền tệ mặc định")}</Label>
        <NativeSelect
          id="st-currency"
          name="defaultCurrency"
          key={values.defaultCurrency}
          defaultValue={values.defaultCurrency}
          aria-invalid={Boolean(state?.errors?.defaultCurrency)}
          aria-describedby="st-currency-hint st-currency-error"
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </NativeSelect>
        <p id="st-currency-hint" className="text-xs text-muted-foreground">{t("Báo cáo, tổng quan và ngân sách được quy về tiền tệ này. Khi đổi, số liệu cũ được quy đổi lại theo tỷ giá của ngày giao dịch, và hạn mức ngân sách được quy đổi theo tỷ giá hiện tại.")}</p>
        <FieldError id="st-currency-error" messages={state?.errors?.defaultCurrency} />
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang lưu...") : t("Lưu cài đặt")}
      </Button>
    </form>
  );
}
