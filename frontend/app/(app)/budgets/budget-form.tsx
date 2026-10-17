"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { BudgetFormState } from "@/app/actions/budgets";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  action: (state: BudgetFormState, formData: FormData) => Promise<BudgetFormState>;
  currency: string;
  // Create mode: the month and the category choices. Edit mode: only the limit can change.
  create?: { month: string; categories: { id: string; label: string }[] };
  defaults: { categoryId?: string; amountLimit: string };
  cancelHref?: string;
};

export function BudgetForm({ action, currency, create, defaults, cancelHref }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };

  return (
    <form action={formAction} className="grid gap-4">
      {!create && <FormNavigationMarker />}
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã đặt ngân sách.")}</p>
      )}
      <FieldError id="bg-month-error" messages={state?.errors?.month} />

      {create && (
        <>
          <input type="hidden" name="month" value={create.month} />
          <div className="grid gap-2">
            <Label htmlFor="bg-category">{t("Áp dụng cho")}</Label>
            <NativeSelect
              id="bg-category"
              name="categoryId"
              key={values.categoryId}
              defaultValue={values.categoryId ?? ""}
              aria-invalid={Boolean(state?.errors?.categoryId)}
              aria-describedby="bg-category-hint bg-category-error"
            >
              <option value="">{t("Tổng chi tiêu của tháng")}</option>
              {create.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </NativeSelect>
            <p id="bg-category-hint" className="text-xs text-muted-foreground">{t("Ngân sách của danh mục cha tính cả các danh mục con.")}</p>
            <FieldError id="bg-category-error" messages={state?.errors?.categoryId} />
          </div>
        </>
      )}

      <div className="grid gap-2">
        <Label htmlFor="bg-amount">{t("Hạn mức ({0})", currency)}</Label>
        <Input
          id="bg-amount"
          name="amountLimit"
          required
          inputMode="decimal"
          placeholder={t("Ví dụ: 3000000")}
          defaultValue={values.amountLimit}
          aria-invalid={Boolean(state?.errors?.amountLimit)}
          aria-describedby="bg-amount-error"
        />
        <FieldError id="bg-amount-error" messages={state?.errors?.amountLimit} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("Đang lưu...") : create ? t("Đặt ngân sách") : t("Lưu thay đổi")}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>{t("Hủy")}</Link>
        )}
      </div>
    </form>
  );
}
