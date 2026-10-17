"use client";

import { FileDown } from "lucide-react";
import { useState, type FormEvent } from "react";
import { STATEMENT_ERRORS, STATEMENT_MAX_DAYS, statementDays, type StatementError } from "@fm/shared/reports";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  accounts: { id: string; name: string; currency: string; archived: boolean }[];
  defaultCurrency: string;
  defaults: { from: string; to: string };
  // A refusal reported by the server after the last download attempt.
  error: StatementError | null;
};

// Downloads the PDF statement for a period. A plain GET form: the browser receives the file as a download
// and stays on the page (data-download keeps the page-loading skeleton away). The dates are checked here
// first so that a mistake does not cost a round trip; the server checks them again.
export function StatementForm({ accounts, defaultCurrency, defaults, error }: Props) {
  const { t } = useI18n();
  const [problem, setProblem] = useState<StatementError | null>(error);

  const check = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const from = String(data.get("from") ?? "");
    const to = String(data.get("to") ?? "");
    const issue: StatementError | null =
      !from || !to || from > to ? "invalid" : statementDays(from, to) > STATEMENT_MAX_DAYS ? "range" : null;
    setProblem(issue);
    if (issue) event.preventDefault();
  };

  return (
    <form action="/transactions/statement" method="get" data-download onSubmit={check} className="grid gap-4">
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {t(STATEMENT_ERRORS[problem])}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <div className="grid gap-1.5">
          <Label htmlFor="st-from">{t("Từ ngày")}</Label>
          <Input id="st-from" name="from" type="date" required defaultValue={defaults.from} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="st-to">{t("Đến ngày")}</Label>
          <Input id="st-to" name="to" type="date" required defaultValue={defaults.to} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="st-account">{t("Tài khoản")}</Label>
        <NativeSelect id="st-account" name="accountId" defaultValue="">
          <option value="">{t("Tất cả tài khoản (quy về {0})", defaultCurrency)}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency}){account.archived ? t(" (đã lưu trữ)") : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" variant="outline" className="justify-self-start">
        <FileDown aria-hidden />
        {t("Tải sao kê PDF")}
      </Button>
    </form>
  );
}
