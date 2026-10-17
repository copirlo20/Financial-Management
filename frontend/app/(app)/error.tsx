"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonVariants } from "@/components/ui/button";

// The raw error message is never shown: it can contain internal details. The digest lets support find it in logs.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-lg border border-destructive/40 p-6">
      <h1 className="text-xl font-semibold">{t("Đã xảy ra lỗi")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("Không tải được trang này. Hãy thử lại; nếu vẫn lỗi, vui lòng quay lại sau.")}
      </p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">{t("Mã lỗi: {0}", error.digest)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry()}>{t("Thử lại")}</Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          {t("Về trang tổng quan")}
        </Link>
      </div>
    </div>
  );
}
