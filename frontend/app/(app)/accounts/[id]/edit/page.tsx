import type { Metadata } from "next";
import type { AccountView } from "@fm/backend/views/accounts";
import { updateAccount } from "@/app/actions/accounts";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { AccountForm } from "../../account-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa tài khoản") };
}

export default async function EditAccountPage({ params }: PageProps<"/accounts/[id]/edit">) {
  const { t } = await getI18n();
  await requireUser();

  const account = await apiGet<AccountView>(`/accounts/${encodeURIComponent((await params).id)}`);
  if (!account) return <NotFoundMessage />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa tài khoản")}</CardTitle>
      </CardHeader>
      <CardContent>
        <AccountForm
          action={updateAccount.bind(null, account.id)}
          mode="edit"
          defaults={{
            name: account.name,
            type: account.type,
            currency: account.currency,
            initialBalance: account.initialBalance.toString(),
          }}
        />
      </CardContent>
    </Card>
  );
}
