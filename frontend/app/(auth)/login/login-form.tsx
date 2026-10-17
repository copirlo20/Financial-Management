"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
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

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("Đăng nhập")}</CardTitle>
        <CardDescription>{t("Theo dõi thu chi và ngân sách của bạn.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          {state?.message && (
            <p role="alert" className="text-sm text-destructive">
              {t(state.message ?? "")}
            </p>
          )}
          {next && <input type="hidden" name="next" value={next} />}

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
              autoComplete="current-password"
              required
              aria-invalid={Boolean(state?.errors?.password)}
              aria-describedby="password-error"
            />
            <FieldError id="password-error" messages={state?.errors?.password} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("Đang đăng nhập...") : t("Đăng nhập")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">{t("Chưa có tài khoản?")}{"\u00a0"}<Link href="/register" className="font-medium text-foreground underline underline-offset-4">{t("Đăng ký")}</Link>
      </CardFooter>
    </Card>
  );
}
