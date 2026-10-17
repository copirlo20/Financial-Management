"use client";

import { useActionState } from "react";
import { deleteContribution } from "@/app/actions/savings";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function DeleteContributionButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(deleteContribution, undefined);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? t("Đang xóa...") : t("Xóa")}
      </Button>
      {state?.message && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {t(state.message ?? "")}
        </p>
      )}
    </form>
  );
}
