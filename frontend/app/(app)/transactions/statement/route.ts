import type { NextRequest } from "next/server";
import { isStatementError } from "@fm/shared/reports";
import { backendFetch, downloadResponse } from "@/lib/api/client";

// Download of the PDF account statement; the backend builds it. A refusal sends the browser back to the
// transactions page with the reason, which the statement form shows.
export async function GET(request: NextRequest) {
  const query = new URLSearchParams();
  for (const name of ["from", "to", "accountId"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value !== null) query.set(name, value);
  }
  const upstream = await backendFetch(`/reports/statement?${query}`);
  if (upstream.status === 401) return Response.redirect(new URL("/login", request.nextUrl), 303);
  if (!upstream.ok) {
    const code = await upstream
      .json()
      .then((body: { message?: unknown }) => body.message)
      .catch(() => null);
    const back = new URL("/transactions", request.nextUrl);
    back.searchParams.set("statementError", isStatementError(code) ? code : "failed");
    return Response.redirect(back, 303);
  }
  return downloadResponse(upstream);
}
