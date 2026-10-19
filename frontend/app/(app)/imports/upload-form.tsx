"use client";

import { useActionState } from "react";
import { AI_PROVIDER_NAMES, type AiProvider } from "@fm/shared/ai";
import { uploadImport } from "@/app/actions/imports";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  accounts: { id: string; name: string; currency: string }[];
  // The AI service the server uses, or null when it has no API key; then every file is mapped by hand.
  aiProvider: AiProvider | null;
};

export function UploadForm({ accounts, aiProvider }: Props) {
  const { t } = useI18n();
  const aiEnabled = aiProvider !== null;
  const names = aiProvider ? AI_PROVIDER_NAMES[aiProvider] : null;
  const [state, formAction, pending] = useActionState(uploadImport, undefined);
  const accountId = state?.values?.accountId ?? accounts[0]?.id;

  return (
    <form action={formAction} className="grid gap-4">
      <FormNavigationMarker />
      <FormMessage message={state?.message} />

      <div className="grid gap-2">
        <Label htmlFor="up-account">{t("Nhập vào tài khoản")}</Label>
        <NativeSelect
          id="up-account"
          name="accountId"
          key={accountId}
          defaultValue={accountId}
          aria-invalid={Boolean(state?.errors?.accountId)}
          aria-describedby="up-account-error"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </NativeSelect>
        <FieldError id="up-account-error" messages={state?.errors?.accountId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="up-file">{t("File sao kê")}</Label>
        <Input
          id="up-file"
          name="file"
          type="file"
          required
          accept=".pdf,.xlsx"
          aria-invalid={Boolean(state?.errors?.file)}
          aria-describedby="up-file-hint up-file-error"
        />
        <p id="up-file-hint" className="text-xs text-muted-foreground">
          {t("Sao kê PDF tải từ ngân hàng hoặc file Excel (.xlsx), tối đa 5 MB và 10.000 dòng. Chưa có gì được ghi cho tới khi bạn xác nhận ở bước sau.")}
        </p>
        <FieldError id="up-file-error" messages={state?.errors?.file} />
      </div>

      {aiEnabled && (
        <div className="grid gap-1">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="useAi" defaultChecked className="mt-0.5 size-4" aria-describedby="up-ai-hint" />
            <span>{t("Dùng trợ lý AI ({0}) để phân tích file", names?.assistant ?? "")}</span>
          </label>
          <p id="up-ai-hint" className="text-xs text-muted-foreground">
            {t("Trợ lý đọc toàn bộ file, liệt kê các giao dịch và gợi ý danh mục cho từng giao dịch, và đọc được cả PDF scan. Nội dung file được gửi tới {0} để phân tích; bỏ chọn nếu bạn muốn tự ghép cột.", names?.company ?? "")}
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? (aiEnabled ? t("Đang tải lên và phân tích...") : t("Đang tải lên...")) : t("Tải lên và xem trước")}
      </Button>
    </form>
  );
}
