import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { SessionView } from "@fm/backend/views/overview";
import type { AiProvider } from "@fm/shared/ai";
import { ACCESS_TOKEN_COOKIE } from "@fm/shared/auth";
import { backendFetch } from "@/lib/api/client";
import { decode } from "@/lib/api/wire";

// Who the backend says is signed in, asked once per request. The backend checks the token and the
// account on every call, so a disabled or deleted account loses access immediately.
const getSession = cache(async (): Promise<SessionView | null> => {
  if (!(await cookies()).get(ACCESS_TOKEN_COOKIE)?.value) return null;
  const response = await backendFetch("/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`The backend answered ${response.status} to GET /me`);
  return decode(await response.json()) as SessionView;
});

export type CurrentUser = SessionView["user"];

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getSession())?.user ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// 404 rather than "forbidden" so non-admins cannot tell that admin pages exist. This only decides what
// the page shows: the backend refuses admin data and admin changes to anyone else by itself.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

// Which AI service the server uses for the assistant, or null when none is configured in the backend.
export async function aiProvider(): Promise<AiProvider | null> {
  return (await getSession())?.aiProvider ?? null;
}
