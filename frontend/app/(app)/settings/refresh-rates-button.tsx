"use client";

import { useActionState } from "react";
import { refreshExchangeRates } from "@/app/actions/settings";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function RefreshRatesButton() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(refreshExchangeRates, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? t("Đang cập nhật...") : t("Cập nhật tỷ giá ngay")}
      </Button>
      {state?.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {t(state.message ?? "")}
        </p>
      )}
    </form>
  );
}
