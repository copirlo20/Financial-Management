import { backendFetch } from "@/lib/api/client";

// The chat panel posts here; the question goes on to the backend, and its streamed answer comes back
// through this response unchanged (see backend/src/handlers/chat.ts for the format).
export async function POST(request: Request) {
  // Only pages of this site may post here with the session cookie.
  const origin = request.headers.get("origin");
  if (origin && URL.parse(origin)?.host !== request.headers.get("host")) {
    return Response.json({ message: "Tin nhắn không hợp lệ." }, { status: 403 });
  }

  const upstream = await backendFetch("/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    signal: request.signal,
  });
  if (upstream.status === 401) {
    return Response.json({ message: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." }, { status: 401 });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
