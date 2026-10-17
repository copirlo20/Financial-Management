import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Đăng ký") };
}

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <RegisterForm />;
}
