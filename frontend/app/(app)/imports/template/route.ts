import { backendFetch } from "@/lib/api/client";

// Download of the sample statement file (Excel); the backend builds it.
export async function GET() {
  const upstream = await backendFetch("/imports/template");
  if (!upstream.ok) return new Response(null, { status: upstream.status });

  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { headers });
}
