import type { Metadata } from "next";
import type { TransactionView } from "@fm/backend/views/transactions";
import { dateToIsoDate } from "@fm/shared/dates";
import { updateTransaction } from "@/app/actions/transactions";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { TransactionForm } from "../../transaction-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa giao dịch") };
}

export default async function EditTransactionPage({ params }: PageProps<"/transactions/[id]/edit">) {
  const { t } = await getI18n();
  await requireUser();

  const data = await apiGet<TransactionView>(`/transactions/${encodeURIComponent((await params).id)}`);
  if (!data) return <NotFoundMessage />;
  const { transaction, accounts, categoryOptions } = data;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa giao dịch")}</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm
          action={updateTransaction.bind(null, transaction.id)}
          mode="edit"
          accounts={accounts
            .filter((account) => !account.archivedAt || account.id === transaction.accountId)
            .map(({ id, name, currency }) => ({ id, name, currency }))}
          categories={categoryOptions}
          defaults={{
            type: transaction.type,
            accountId: transaction.accountId,
            categoryId: transaction.categoryId ?? "",
            amount: transaction.amount.toString(),
            date: dateToIsoDate(transaction.date),
            note: transaction.note ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
