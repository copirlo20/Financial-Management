import { backendFetch, downloadResponse } from "@/lib/api/client";

// Download of the sample statement file (Excel); the backend builds it.
export async function GET() {
  const upstream = await backendFetch("/imports/template");
  if (!upstream.ok) return new Response(null, { status: upstream.status });
  return downloadResponse(upstream);
}
