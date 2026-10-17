"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { deleteImport } from "@/app/actions/imports";
import { ConfirmButton } from "@/components/confirm-button";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  id: string;
  fileName: string;
  // Transactions this import created and still holds; they are deleted with it.
  transactionCount: number;
  // "icon" for a row of the list, "button" for the detail page.
  appearance?: "icon" | "button";
};

export function DeleteImportButton({ id, fileName, transactionCount, appearance = "button" }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(deleteImport, undefined);
  // What goes with the import is the part worth reading; the name only says which import it is.
  const detail =
    transactionCount > 0
      ? t("Xóa kèm {0} giao dịch của nó và trả lại số dư tài khoản. Thao tác này không thể hoàn tác.", transactionCount)
      : undefined;

  return (
    <form action={formAction} className={appearance === "icon" ? "contents" : "grid gap-2"}>
      <input type="hidden" name="id" value={id} />
      {appearance === "icon" ? (
        <ConfirmButton
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("Xóa lần nhập \"{0}\"", fileName)}
          className="text-muted-foreground hover:text-destructive"
          confirmMessage={t("Xóa lần nhập này?")}
          confirmSubject={fileName}
          confirmDetail={detail}
          confirmLabel={t("Xóa")}
          confirmIcon="trash"
        >
          <Trash2 />
        </ConfirmButton>
      ) : (
        <ConfirmButton
          variant="outline"
          disabled={pending}
          className="justify-self-start text-destructive hover:text-destructive"
          confirmMessage={t("Xóa lần nhập này?")}
          confirmSubject={fileName}
          confirmDetail={detail}
          confirmLabel={t("Xóa")}
          confirmIcon="trash"
        >
          <Trash2 />
          {pending ? t("Đang xóa...") : t("Xóa lần nhập này")}
        </ConfirmButton>
      )}
      {state?.message && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {t(state.message ?? "")}
        </p>
      )}
    </form>
  );
}
