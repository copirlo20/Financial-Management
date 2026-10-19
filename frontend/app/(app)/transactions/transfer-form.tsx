"use client";

import { useActionState } from "react";
import { createTransfer } from "@/app/actions/transactions";
import { DateInput } from "@/components/date-input";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountOption } from "./transaction-form";

type Props = {
  accounts: AccountOption[];
  defaults: { fromAccountId: string; toAccountId: string; date: string };
};

export function TransferForm({ accounts, defaults }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createTransfer, undefined);
  const values = { amount: "", toAmount: "", note: "", ...defaults, ...state?.values };

  const accountOptions = accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.name} ({account.currency})
    </option>
  ));

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã chuyển khoản.")}</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="tf-from">{t("Từ tài khoản")}</Label>
        <NativeSelect
          id="tf-from"
          name="fromAccountId"
          key={values.fromAccountId}
          defaultValue={values.fromAccountId}
          aria-invalid={Boolean(state?.errors?.fromAccountId)}
          aria-describedby="tf-from-error"
        >
          {accountOptions}
        </NativeSelect>
        <FieldError id="tf-from-error" messages={state?.errors?.fromAccountId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tf-to">{t("Đến tài khoản")}</Label>
        <NativeSelect
          id="tf-to"
          name="toAccountId"
          key={values.toAccountId}
          defaultValue={values.toAccountId}
          aria-invalid={Boolean(state?.errors?.toAccountId)}
          aria-describedby="tf-to-error"
        >
          {accountOptions}
        </NativeSelect>
        <FieldError id="tf-to-error" messages={state?.errors?.toAccountId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tf-amount">{t("Số tiền chuyển")}</Label>
        <Input
          id="tf-amount"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={values.amount}
          aria-invalid={Boolean(state?.errors?.amount)}
          aria-describedby="tf-amount-error"
        />
        <FieldError id="tf-amount-error" messages={state?.errors?.amount} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tf-to-amount">{t("Số tiền nhận")}</Label>
        <Input
          id="tf-to-amount"
          name="toAmount"
          inputMode="decimal"
          defaultValue={values.toAmount}
          aria-invalid={Boolean(state?.errors?.toAmount)}
          aria-describedby="tf-to-amount-hint tf-to-amount-error"
        />
        <p id="tf-to-amount-hint" className="text-xs text-muted-foreground">{t("Chỉ cần nhập khi hai tài khoản khác tiền tệ.")}</p>
        <FieldError id="tf-to-amount-error" messages={state?.errors?.toAmount} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tf-date">{t("Ngày")}</Label>
        <DateInput
          id="tf-date"
          name="date"
          required
          defaultValue={values.date}
          aria-invalid={Boolean(state?.errors?.date)}
          aria-describedby="tf-date-error"
        />
        <FieldError id="tf-date-error" messages={state?.errors?.date} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tf-note">{t("Ghi chú")}</Label>
        <Input
          id="tf-note"
          name="note"
          maxLength={200}
          defaultValue={values.note}
          aria-invalid={Boolean(state?.errors?.note)}
          aria-describedby="tf-note-error"
        />
        <FieldError id="tf-note-error" messages={state?.errors?.note} />
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang chuyển...") : t("Chuyển khoản")}
      </Button>
    </form>
  );
}
