"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/settings";
import { FieldError } from "@/components/field-error";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "currentPassword", label: "Mật khẩu hiện tại", autoComplete: "current-password" },
  { name: "newPassword", label: "Mật khẩu mới", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Nhập lại mật khẩu mới", autoComplete: "new-password" },
] as const;

// Passwords are never filled back in: after a submit, successful or not, the fields start empty.
export function PasswordForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="grid gap-4">
      {state?.message && (
        <p role={state.success ? "status" : "alert"} className={`text-sm ${state.success ? "text-muted-foreground" : "text-destructive"}`}>
          {t(state.message)}
        </p>
      )}
      {FIELDS.map(({ name, label, autoComplete }) => (
        <div key={name} className="grid gap-2">
          <Label htmlFor={`pw-${name}`}>{t(label)}</Label>
          <Input
            id={`pw-${name}`}
            name={name}
            type="password"
            required
            maxLength={128}
            autoComplete={autoComplete}
            aria-invalid={Boolean(state?.errors?.[name])}
            aria-describedby={`pw-${name}-error`}
          />
          <FieldError id={`pw-${name}-error`} messages={state?.errors?.[name]} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("Ít nhất 8 ký tự, có cả chữ và số.")}</p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("Đang lưu...") : t("Đổi mật khẩu")}
      </Button>
    </form>
  );
}
