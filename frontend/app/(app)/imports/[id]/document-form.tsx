"use client";

import { useActionState } from "react";
import type { DocumentFormState } from "@/app/actions/imports";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RowCategories, type ReviewRow } from "./row-categories";

type Option = { value: string; label: string };
type FieldName = "expenseCategoryId" | "incomeCategoryId";

type Props = {
  action: (state: DocumentFormState, formData: FormData) => Promise<DocumentFormState>;
  expenseCategories: Option[];
  incomeCategories: Option[];
  defaults: Record<FieldName, string>;
  rows: ReviewRow[];
  totalRows: number;
};

// Confirm step for a PDF: the assistant already read the rows, so only categories are left to choose.
export function DocumentForm({ action, expenseCategories, incomeCategories, defaults, rows, totalRows }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };

  // content-start: the two fields line up at the top even when only one shows an error.
  const select = (name: FieldName, label: string, options: Option[]) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={`doc-${name}`}>{label}</Label>
      <NativeSelect
        id={`doc-${name}`}
        name={name}
        key={values[name]}
        defaultValue={values[name]}
        aria-invalid={Boolean(state?.errors?.[name])}
        aria-describedby={`doc-${name}-error`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <FieldError id={`doc-${name}-error`} messages={state?.errors?.[name]} />
    </div>
  );

  return (
    <form action={formAction} className="grid gap-4 [&>*]:min-w-0">
      <FormNavigationMarker />
      <FormMessage message={state?.message} className="whitespace-pre-line" />

      <div className="grid gap-4 sm:grid-cols-2">
        {select("expenseCategoryId", t("Danh mục cho khoản chi"), expenseCategories)}
        {select("incomeCategoryId", t("Danh mục cho khoản thu"), incomeCategories)}
      </div>

      <RowCategories
        rows={rows}
        totalRows={totalRows}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        picked={state?.rowCategories}
      />

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang nhập...") : t("Xác nhận và nhập giao dịch")}
      </Button>
    </form>
  );
}
