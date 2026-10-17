"use client";

import { useActionState } from "react";
import { rollbackImport } from "@/app/actions/imports";
import { ConfirmButton } from "@/components/confirm-button";
import { useI18n } from "@/components/i18n-provider";

export function RollbackButton({ id, count }: { id: string; count: number }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(rollbackImport, undefined);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton
        variant="destructive"
        disabled={pending}
        className="justify-self-start"
        confirmMessage={t("Hoàn tác lần nhập này?")}
        confirmDetail={t("Xóa {0} giao dịch của lần nhập này và trả lại số dư tài khoản. Thao tác này không thể hoàn tác.", count)}
        confirmLabel={t("Hoàn tác")}
        confirmIcon="undo"
      >
        {pending ? t("Đang hoàn tác...") : t("Hoàn tác lần nhập này")}
      </ConfirmButton>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(state.message ?? "")}
        </p>
      )}
    </form>
  );
}
