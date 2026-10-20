import type { Metadata } from "next";
import Link from "next/link";
import type { ImportView } from "@fm/backend/views/imports";
import { formatMoney } from "@fm/shared/currencies";
import { formatDate, formatDay, isoDateToDate } from "@fm/shared/dates";
import { cellText, columnLetter, readImportErrors, storedImportErrors } from "@fm/shared/imports";
import { IMPORT_STATUS_LABELS } from "@fm/shared/labels";
import { cancelImport, confirmDocumentImport, confirmImport } from "@/app/actions/imports";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { NotFoundMessage } from "@/components/not-found-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { DeleteImportButton } from "../delete-import-button";
import { DocumentForm } from "./document-form";
import { MappingForm } from "./mapping-form";
import { RollbackButton } from "./rollback-button";
import { RowErrors } from "./row-errors";
import type { ReviewRow } from "./row-categories";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Chi tiết lần nhập") };
}

type ExtractedRows = NonNullable<NonNullable<ImportView["pending"]>["document"]>;

// The rows the assistant read, formatted for the review table (the backend sends the first ones only).
function reviewRows({ rows, categories }: ExtractedRows, currency: string, locale: string): ReviewRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    date: formatDate(isoDateToDate(row.date)),
    amount: formatMoney(row.amount, currency, locale),
    type: row.type,
    description: row.description,
    categoryId: categories[String(row.rowNumber)] ?? "",
  }));
}

export default async function ImportDetailPage({ params }: PageProps<"/imports/[id]">) {
  const { t, locale } = await getI18n();
  await requireUser();

  const data = await apiGet<ImportView>(`/imports/${encodeURIComponent((await params).id)}`);
  if (!data) return <NotFoundMessage />;
  const { batch, pending } = data;

  const heading = (
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-semibold">{batch.fileName}</h1>
      <p className="text-sm wrap-break-word text-muted-foreground">
        {t("{0} · Tài khoản {1} ({2})", formatDay(batch.createdAt), batch.account.name, batch.account.currency)} ·{" "}
        {t(IMPORT_STATUS_LABELS[batch.status])}
      </p>
    </div>
  );
  const cancelForm = (
    <form action={cancelImport}>
      <FormNavigationMarker />
      <input type="hidden" name="id" value={batch.id} />
      <Button type="submit" variant="outline">{t("Hủy lần nhập này")}</Button>
    </form>
  );

  if (!pending) {
    const failedRows = batch.rowCount - batch.importedCount - batch.skippedCount;
    const rowErrors = readImportErrors(batch.errorMessage);
    return (
      <>
        {heading}
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{t("Kết quả")}</CardTitle>
            {batch.status === "ROLLED_BACK" && (
              <CardDescription>{t("Lần nhập này đã được hoàn tác; các giao dịch của nó đã bị xóa.")}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border bg-card shadow-xs p-3">
                <dt className="text-xs text-muted-foreground">{t("Đã nhập")}</dt>
                <dd className="text-xl font-semibold tabular-nums">{batch.importedCount}</dd>
              </div>
              <div className="rounded-lg border bg-card shadow-xs p-3">
                <dt className="text-xs text-muted-foreground">{t("Bỏ qua vì trùng")}</dt>
                <dd className="text-xl font-semibold tabular-nums">{batch.skippedCount}</dd>
              </div>
              <div className="rounded-lg border bg-card shadow-xs p-3">
                <dt className="text-xs text-muted-foreground">{t("Dòng lỗi")}</dt>
                <dd className="text-xl font-semibold tabular-nums">{failedRows}</dd>
              </div>
            </dl>
            {batch.skippedCount > 0 && (
              <p className="text-sm text-muted-foreground">{t("Dòng bị bỏ qua là dòng trùng ngày, số tiền và diễn giải với giao dịch đã nhập trước đó vào tài khoản này.")}</p>
            )}
            {rowErrors && <RowErrors errors={rowErrors} t={t} />}
            <div className="flex flex-wrap items-start gap-3">
              <Link
                href={`/transactions?accountId=${batch.account.id}`}
                className={buttonVariants({ variant: "outline" })}
              >{t("Xem giao dịch của tài khoản")}</Link>
              {batch.status === "PROCESSED" && <RollbackButton id={batch.id} count={batch.importedCount} />}
              <DeleteImportButton
                id={batch.id}
                fileName={batch.fileName}
                transactionCount={batch.status === "PROCESSED" ? batch.importedCount : 0}
              />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const { expenseCategories, incomeCategories, categoryDefaults, document: extracted, table } = pending;
  if (extracted) {
    return (
      <>
        {heading}
        <Card>
          <CardHeader>
            <CardTitle>{t("Giao dịch trợ lý AI đọc được")}</CardTitle>
            <CardDescription>
              {t("Trợ lý AI đọc được {0} giao dịch từ file. Hãy đối chiếu ngày và số tiền với sao kê trước khi xác nhận, vì AI có thể đọc nhầm.", extracted.totalRows)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 *:min-w-0">
            {extracted.errors.length > 0 && <RowErrors errors={storedImportErrors(extracted.errors)} t={t} />}
            <DocumentForm
              action={confirmDocumentImport.bind(null, batch.id)}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              defaults={categoryDefaults}
              rows={reviewRows(extracted, batch.account.currency, locale)}
              totalRows={extracted.totalRows}
            />
            {cancelForm}
          </CardContent>
        </Card>
      </>
    );
  }

  if (!table) {
    return (
      <>
        {heading}
        <p role="alert" className="text-sm text-destructive">{t("File tạm của lần nhập này không còn. Hãy hủy và tải file lên lại.")}</p>
        {cancelForm}
      </>
    );
  }

  const { suggestion, headerCells, columnCount, preview, totalRows } = table;
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const header = cellText(headerCells[index] ?? null);
    return { value: String(index), label: header ? `${columnLetter(index)} — ${header}` : columnLetter(index) };
  });

  const columnValue = (column: number | null) => (column === null ? "" : String(column));

  return (
    <>
      {heading}

      <Card>
        <CardHeader>
          <CardTitle>{t("Xem trước")}</CardTitle>
          <CardDescription>
            {t("{0} dòng đầu trong tổng số {1} dòng có dữ liệu.", preview.length, totalRows)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    #
                  </th>
                  {columns.map((column) => (
                    <th key={column.value} scope="col" className="px-2 py-1.5 font-medium">
                      {columnLetter(Number(column.value))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex + 1 === suggestion.headerRow ? "border-t font-semibold" : "border-t"}>
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{rowIndex + 1}</td>
                    {columns.map((column) => (
                      <td key={column.value} className="max-w-56 truncate px-2 py-1.5 whitespace-nowrap">
                        {cellText(row[Number(column.value)] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Ghép cột")}</CardTitle>
          <CardDescription>{t("Bước 2/2: cho biết cột nào là ngày, số tiền và diễn giải. Các lựa chọn đã được đoán sẵn theo tên cột.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 *:min-w-0">
          {pending.aiFailed && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("Trợ lý AI không đọc được file này, nên bạn cần tự ghép cột bên dưới.")}
            </p>
          )}
          <MappingForm
            action={confirmImport.bind(null, batch.id)}
            columns={columns}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            defaults={{
              headerRow: String(suggestion.headerRow),
              dateColumn: String(suggestion.dateColumn),
              dateFormat: suggestion.dateFormat,
              amountMode: suggestion.amountMode,
              amountColumn: columnValue(suggestion.amountColumn),
              debitColumn: columnValue(suggestion.debitColumn),
              creditColumn: columnValue(suggestion.creditColumn),
              descriptionColumn: columnValue(suggestion.descriptionColumn),
              decimalSeparator: suggestion.decimalSeparator,
              ...categoryDefaults,
            }}
          />
          {cancelForm}
        </CardContent>
      </Card>
    </>
  );
}
