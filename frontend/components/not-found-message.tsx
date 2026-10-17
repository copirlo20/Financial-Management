"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { buttonVariants } from "@/components/ui/button";

// Synchronous on purpose: an async not-found component is left out of the server-rendered HTML
// and only appears once JavaScript has loaded.
export function NotFoundMessage() {
  const { t } = useI18n();

  return (
    <div className="grid justify-items-start gap-3 rounded-lg border bg-card shadow-xs p-6">
      <h1 className="text-xl font-semibold">{t("Không tìm thấy trang")}</h1>
      <p className="text-sm text-muted-foreground">{t("Trang này không tồn tại hoặc bạn không có quyền xem.")}</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
        {t("Về trang tổng quan")}
      </Link>
    </div>
  );
}
