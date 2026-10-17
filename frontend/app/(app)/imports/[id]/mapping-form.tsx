"use client";

import { useActionState } from "react";
import type { MappingFormState } from "@/app/actions/imports";
import { FieldError } from "@/components/field-error";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };
type Values = NonNullable<NonNullable<MappingFormState>["values"]>;
type FieldName = keyof Values;

type Props = {
  action: (state: MappingFormState, formData: FormData) => Promise<MappingFormState>;
  columns: Option[];
  expenseCategories: Option[];
  incomeCategories: Option[];
  defaults: Record<FieldName, string>;
};

const DATE_FORMATS: Option[] = [
  { value: "DMY", label: "Ngày/Tháng/Năm (31/12/2026)" },
  { value: "MDY", label: "Tháng/Ngày/Năm (12/31/2026)" },
  { value: "YMD", label: "Năm-Tháng-Ngày (2026-12-31)" },
];
const AMOUNT_MODES: Option[] = [
  { value: "signed", label: "Một cột: số âm là chi, số dương là thu" },
  { value: "split", label: "Hai cột: tiền ra và tiền vào riêng" },
];
const DECIMAL_SEPARATORS: Option[] = [
  { value: ".", label: "Dấu chấm (1,500,000.50)" },
  { value: ",", label: "Dấu phẩy (1.500.000,50)" },
];

export function MappingForm({ action, columns, expenseCategories, incomeCategories, defaults }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };
  const unused: Option = { value: "", label: t("Không dùng") };

  // content-start: fields side by side line up at the top even when one has a longer hint or an error,
  // instead of the taller one's extra height pushing its neighbour's control down.
  const select = (name: FieldName, label: string, options: Option[], hint?: string) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={`map-${name}`}>{label}</Label>
      <NativeSelect
        id={`map-${name}`}
        name={name}
        key={values[name]}
        defaultValue={values[name]}
        aria-invalid={Boolean(state?.errors?.[name])}
        aria-describedby={`map-${name}-hint map-${name}-error`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </NativeSelect>
      {hint && (
        <p id={`map-${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`map-${name}-error`} messages={state?.errors?.[name]} />
    </div>
  );

  return (
    <form action={formAction} className="grid gap-4 [&>*]:min-w-0">
      <FormNavigationMarker />
      {state?.message && (
        <p role="alert" className="text-sm whitespace-pre-line text-destructive">
          {t(state.message ?? "")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor="map-headerRow">{t("Dòng tiêu đề")}</Label>
          <Input
            id="map-headerRow"
            name="headerRow"
            type="number"
            min={0}
            max={1000}
            required
            defaultValue={values.headerRow}
            aria-invalid={Boolean(state?.errors?.headerRow)}
            aria-describedby="map-headerRow-hint map-headerRow-error"
          />
          <p id="map-headerRow-hint" className="text-xs text-muted-foreground">{t("Dữ liệu được đọc từ dòng ngay sau dòng này. Nhập 0 nếu file không có dòng tiêu đề.")}</p>
          <FieldError id="map-headerRow-error" messages={state?.errors?.headerRow} />
        </div>
        {select("descriptionColumn", t("Cột diễn giải"), [unused, ...columns], t("Được lưu làm ghi chú của giao dịch."))}
        {select("dateColumn", t("Cột ngày"), columns)}
        {select("dateFormat", t("Định dạng ngày"), DATE_FORMATS)}
        {select("amountMode", t("Kiểu cột số tiền"), AMOUNT_MODES)}
        {select("decimalSeparator", t("Dấu thập phân"), DECIMAL_SEPARATORS)}
        {select("amountColumn", t("Cột số tiền (kiểu một cột)"), [unused, ...columns])}
        <div className="hidden sm:block" />
        {select("debitColumn", t("Cột tiền ra (kiểu hai cột)"), [unused, ...columns])}
        {select("creditColumn", t("Cột tiền vào (kiểu hai cột)"), [unused, ...columns])}
        {select("expenseCategoryId", t("Danh mục cho khoản chi"), expenseCategories, t("Sửa từng giao dịch sau khi nhập nếu cần."))}
        {select("incomeCategoryId", t("Danh mục cho khoản thu"), incomeCategories)}
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang nhập...") : t("Xác nhận và nhập giao dịch")}
      </Button>
    </form>
  );
}
