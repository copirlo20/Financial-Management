"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ACCOUNT_TYPE_LABELS } from "@fm/shared/labels";
import type { AccountFormState } from "@/app/actions/accounts";
import { CurrencyOptions } from "@/components/currency-options";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  action: (state: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  mode: "create" | "edit";
  defaults: { name: string; type: string; currency: string; initialBalance: string };
};

export function AccountForm({ action, mode, defaults }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      {mode === "edit" && <FormNavigationMarker />}
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã tạo tài khoản.")}</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">{t("Tên tài khoản")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder={t("Ví dụ: Ví tiền mặt")}
          defaultValue={values.name}
          aria-invalid={Boolean(state?.errors?.name)}
          aria-describedby="name-error"
        />
        <FieldError id="name-error" messages={state?.errors?.name} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="type">{t("Loại")}</Label>
        <NativeSelect
          id="type"
          name="type"
          key={values.type}
          defaultValue={values.type}
          aria-invalid={Boolean(state?.errors?.type)}
          aria-describedby="type-error"
        >
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="type-error" messages={state?.errors?.type} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="currency">{t("Tiền tệ")}</Label>
        {mode === "create" ? (
          <NativeSelect
            id="currency"
            name="currency"
            key={values.currency}
            defaultValue={values.currency}
            aria-invalid={Boolean(state?.errors?.currency)}
            aria-describedby="currency-error"
          >
            <CurrencyOptions />
          </NativeSelect>
        ) : (
          <>
            <Input id="currency" value={values.currency} disabled readOnly aria-describedby="currency-hint" />
            <p id="currency-hint" className="text-xs text-muted-foreground">{t("Không đổi được tiền tệ sau khi tạo tài khoản.")}</p>
          </>
        )}
        <FieldError id="currency-error" messages={state?.errors?.currency} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="initialBalance">{t("Số dư ban đầu")}</Label>
        <Input
          id="initialBalance"
          name="initialBalance"
          required
          inputMode="decimal"
          defaultValue={values.initialBalance}
          aria-invalid={Boolean(state?.errors?.initialBalance)}
          aria-describedby="initialBalance-hint initialBalance-error"
        />
        <p id="initialBalance-hint" className="text-xs text-muted-foreground">
          {mode === "create"
            ? t("Chỉ nhập số, dùng dấu chấm cho phần lẻ. Số âm cho khoản đang nợ.")
            : t("Số dư hiện tại sẽ thay đổi đúng bằng phần chênh lệch.")}
        </p>
        <FieldError id="initialBalance-error" messages={state?.errors?.initialBalance} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("Đang lưu...") : mode === "create" ? t("Thêm tài khoản") : t("Lưu thay đổi")}
        </Button>
        {mode === "edit" && (
          <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>{t("Hủy")}</Link>
        )}
      </div>
    </form>
  );
}
