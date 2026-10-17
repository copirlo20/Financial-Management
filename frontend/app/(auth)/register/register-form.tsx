"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { FieldError } from "@/components/field-error";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(register, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("Tạo tài khoản")}</CardTitle>
        <CardDescription>{t("Miễn phí, chỉ mất chưa đầy một phút.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          {state?.message && (
            <p role="alert" className="text-sm text-destructive">
              {t(state.message ?? "")}
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name">{t("Họ tên")}</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              defaultValue={state?.values?.name}
              aria-invalid={Boolean(state?.errors?.name)}
              aria-describedby="name-error"
            />
            <FieldError id="name-error" messages={state?.errors?.name} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">{t("Email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state?.values?.email}
              aria-invalid={Boolean(state?.errors?.email)}
              aria-describedby="email-error"
            />
            <FieldError id="email-error" messages={state?.errors?.email} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">{t("Mật khẩu")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(state?.errors?.password)}
              aria-describedby="password-hint password-error"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">{t("Ít nhất 8 ký tự, gồm cả chữ cái và chữ số.")}</p>
            <FieldError id="password-error" messages={state?.errors?.password} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">{t("Nhập lại mật khẩu")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(state?.errors?.confirmPassword)}
              aria-describedby="confirmPassword-error"
            />
            <FieldError id="confirmPassword-error" messages={state?.errors?.confirmPassword} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("Đang tạo tài khoản...") : t("Đăng ký")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">{t("Đã có tài khoản?")}{"\u00a0"}<Link href="/login" className="font-medium text-foreground underline underline-offset-4">{t("Đăng nhập")}</Link>
      </CardFooter>
    </Card>
  );
}
