"use client";

import { useActionState } from "react";
import type { DeleteCategoryState } from "@/app/actions/categories";
import { ConfirmButton } from "@/components/confirm-button";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  action: (state: DeleteCategoryState, formData: FormData) => Promise<DeleteCategoryState>;
  id: string;
  name: string;
};

export function DeleteCategoryButton({ action, id, name }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        disabled={pending}
        confirmMessage={t("Xóa danh mục này?")}
        confirmSubject={name}
        confirmLabel={t("Xóa")}
        confirmIcon="trash"
      >
        {pending ? t("Đang xóa...") : t("Xóa")}
      </ConfirmButton>
      {state?.message && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {t(state.message ?? "")}
        </p>
      )}
    </form>
  );
}
