"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { PasswordFormState, RefreshRatesState, SettingsFormState } from "@fm/backend/handlers/settings";
import { command } from "@/lib/api/client";

// Works signed out too (login/register pages); the backend also saves it to a signed-in user's profile.
export async function setLanguage(formData: FormData): Promise<void> {
  await command("POST", "/settings/language", formData);
}

export async function updateSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  return command("PUT", "/settings", formData);
}

export async function refreshExchangeRates(): Promise<RefreshRatesState> {
  return command("POST", "/settings/exchange-rates/refresh");
}

export type { PasswordFormState };

export async function changePassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  return command("PUT", "/settings/password", formData);
}
