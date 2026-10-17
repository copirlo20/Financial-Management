"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import type { GoalFormState } from "@/app/actions/savings";
import { FieldError } from "@/components/field-error";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  mode: "create" | "edit";
  defaults: { name: string; targetAmount: string; currency: string; deadline: string };
  cancelHref?: string;
};

export function GoalForm({ action, mode, defaults, cancelHref }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      <FormNavigationMarker />
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(state.message ?? "")}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="goal-name">{t("Tên mục tiêu")}</Label>
        <Input
          id="goal-name"
          name="name"
          required
          maxLength={60}
          placeholder={t("Ví dụ: Quỹ khẩn cấp")}
          defaultValue={values.name}
          aria-invalid={Boolean(state?.errors?.name)}
          aria-describedby="goal-name-error"
        />
        <FieldError id="goal-name-error" messages={state?.errors?.name} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-target">{t("Số tiền mục tiêu")}</Label>
        <Input
          id="goal-target"
          name="targetAmount"
          required
          inputMode="decimal"
          placeholder={t("Ví dụ: 50000000")}
          defaultValue={values.targetAmount}
          aria-invalid={Boolean(state?.errors?.targetAmount)}
          aria-describedby="goal-target-error"
        />
        <FieldError id="goal-target-error" messages={state?.errors?.targetAmount} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-currency">{t("Tiền tệ")}</Label>
        {mode === "create" ? (
          <NativeSelect
            id="goal-currency"
            name="currency"
            key={values.currency}
            defaultValue={values.currency}
            aria-invalid={Boolean(state?.errors?.currency)}
            aria-describedby="goal-currency-error"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <>
            <Input id="goal-currency" value={values.currency} disabled readOnly aria-describedby="goal-currency-hint" />
            <p id="goal-currency-hint" className="text-xs text-muted-foreground">{t("Không đổi được tiền tệ sau khi tạo mục tiêu.")}</p>
          </>
        )}
        <FieldError id="goal-currency-error" messages={state?.errors?.currency} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-deadline">{t("Hạn chót (không bắt buộc)")}</Label>
        <Input
          id="goal-deadline"
          name="deadline"
          type="date"
          defaultValue={values.deadline}
          aria-invalid={Boolean(state?.errors?.deadline)}
          aria-describedby="goal-deadline-error"
        />
        <FieldError id="goal-deadline-error" messages={state?.errors?.deadline} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("Đang lưu...") : mode === "create" ? t("Tạo mục tiêu") : t("Lưu thay đổi")}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>{t("Hủy")}</Link>
        )}
      </div>
    </form>
  );
}
