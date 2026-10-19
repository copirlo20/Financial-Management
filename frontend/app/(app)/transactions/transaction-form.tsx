"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TRANSACTION_TYPE_LABELS } from "@fm/shared/labels";
import type { TransactionFormState } from "@/app/actions/transactions";
import { DateInput } from "@/components/date-input";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TypeKey = keyof typeof TRANSACTION_TYPE_LABELS;
export type AccountOption = { id: string; name: string; currency: string };
export type CategoryOption = { id: string; label: string; type: TypeKey };

type Props = {
  action: (state: TransactionFormState, formData: FormData) => Promise<TransactionFormState>;
  mode: "create" | "edit";
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaults: { type: string; accountId: string; categoryId: string; amount: string; date: string; note: string };
};

export function TransactionForm({ action, mode, accounts, categories, defaults }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };
  const types = Object.keys(TRANSACTION_TYPE_LABELS) as TypeKey[];

  return (
    <form action={formAction} className="grid gap-4">
      {mode === "edit" && <FormNavigationMarker />}
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã thêm giao dịch.")}</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="tx-type">{t("Loại")}</Label>
        <NativeSelect
          id="tx-type"
          name="type"
          key={values.type}
          defaultValue={values.type}
          aria-invalid={Boolean(state?.errors?.type)}
          aria-describedby="tx-type-error"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {t(TRANSACTION_TYPE_LABELS[type])}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="tx-type-error" messages={state?.errors?.type} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-amount">{t("Số tiền")}</Label>
        <Input
          id="tx-amount"
          name="amount"
          required
          inputMode="decimal"
          placeholder={t("Ví dụ: 50000")}
          defaultValue={values.amount}
          aria-invalid={Boolean(state?.errors?.amount)}
          aria-describedby="tx-amount-error"
        />
        <FieldError id="tx-amount-error" messages={state?.errors?.amount} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-account">{t("Tài khoản")}</Label>
        <NativeSelect
          id="tx-account"
          name="accountId"
          key={values.accountId}
          defaultValue={values.accountId}
          aria-invalid={Boolean(state?.errors?.accountId)}
          aria-describedby="tx-account-error"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </NativeSelect>
        <FieldError id="tx-account-error" messages={state?.errors?.accountId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-category">{t("Danh mục")}</Label>
        <NativeSelect
          id="tx-category"
          name="categoryId"
          key={values.categoryId}
          defaultValue={values.categoryId}
          aria-invalid={Boolean(state?.errors?.categoryId)}
          aria-describedby="tx-category-hint tx-category-error"
        >
          {types.map((type) => (
            <optgroup key={type} label={t(TRANSACTION_TYPE_LABELS[type])}>
              {categories
                .filter((category) => category.type === type)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
        <p id="tx-category-hint" className="text-xs text-muted-foreground">{t("Chọn danh mục cùng nhóm với loại giao dịch.")}</p>
        <FieldError id="tx-category-error" messages={state?.errors?.categoryId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-date">{t("Ngày")}</Label>
        <DateInput
          id="tx-date"
          name="date"
          required
          defaultValue={values.date}
          aria-invalid={Boolean(state?.errors?.date)}
          aria-describedby="tx-date-error"
        />
        <FieldError id="tx-date-error" messages={state?.errors?.date} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-note">{t("Ghi chú")}</Label>
        <Input
          id="tx-note"
          name="note"
          maxLength={200}
          defaultValue={values.note}
          aria-invalid={Boolean(state?.errors?.note)}
          aria-describedby="tx-note-error"
        />
        <FieldError id="tx-note-error" messages={state?.errors?.note} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("Đang lưu...") : mode === "create" ? t("Thêm giao dịch") : t("Lưu thay đổi")}
        </Button>
        {mode === "edit" && (
          <Link href="/transactions" className={buttonVariants({ variant: "outline" })}>{t("Hủy")}</Link>
        )}
      </div>
    </form>
  );
}
