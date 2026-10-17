"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { AuthFormState } from "@fm/backend/handlers/auth";
import { command, formCommand } from "@/lib/api/client";

// The backend answers a successful sign-in with session tokens; command() stores them as cookies.
export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return formCommand("POST", "/auth/register", formData);
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return formCommand("POST", "/auth/login", formData);
}

export async function logout(): Promise<void> {
  await command("POST", "/auth/logout");
}

export async function logoutEverywhere(): Promise<void> {
  await command("POST", "/auth/logout-everywhere");
}
