import type { Metadata } from "next";
import Link from "next/link";
import type { ImportsView } from "@fm/backend/views/imports";
import { formatDay } from "@fm/shared/dates";
import { IMPORT_STATUS_LABELS } from "@fm/shared/labels";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { DeleteImportButton } from "./delete-import-button";
import { UploadForm } from "./upload-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Nhập sao kê") };
}

export default async function ImportsPage() {
  const { t } = await getI18n();
  await requireUser();

  const { accounts, batches, aiProvider } = await apiLoad<ImportsView>("/imports");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Nhập sao kê")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] *:min-w-0">
        <section className="grid gap-2 *:min-w-0">
          {batches.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">{t("Chưa có lần nhập nào. Tải file sao kê từ ngân hàng để thêm nhiều giao dịch cùng lúc.")}</p>
          ) : (
            <ul className="grid gap-2 *:min-w-0">
              {batches.map((batch) => (
                <li key={batch.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card shadow-xs p-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-medium">{batch.fileName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDay(batch.createdAt)} · {batch.account.name} · {t(IMPORT_STATUS_LABELS[batch.status])}
                      {batch.status === "PROCESSED" &&
                        t(" · {0} giao dịch, bỏ qua {1} trùng", batch.importedCount, batch.skippedCount)}
                    </p>
                  </div>
                  <Link href={`/imports/${batch.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {batch.status === "PENDING" ? t("Tiếp tục") : t("Chi tiết")}
                  </Link>
                  <DeleteImportButton
                    id={batch.id}
                    fileName={batch.fileName}
                    transactionCount={batch.status === "PROCESSED" ? batch.importedCount : 0}
                    appearance="icon"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("Tải file sao kê")}</CardTitle>
            <CardDescription>{t("Bước 1/2: chọn tài khoản và file.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <Link href="/accounts" className={buttonVariants()}>{t("Thêm tài khoản trước")}</Link>
            ) : (
              <UploadForm accounts={accounts} aiProvider={aiProvider} />
            )}
            <div className="mt-4 border-t pt-4 text-sm">
              <p className="font-medium">{t("Chưa có file sao kê?")}</p>
              <p className="mt-1 text-muted-foreground">{t("Tải file mẫu, thay các dòng ví dụ bằng giao dịch của bạn rồi tải lên. Số âm là khoản chi, số dương là khoản thu.")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href="/imports/template?format=csv"
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >{t("File mẫu CSV")}</a>
                <a
                  href="/imports/template?format=xlsx"
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >{t("File mẫu Excel")}</a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
