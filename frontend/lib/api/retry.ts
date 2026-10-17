// The backend is restarted now and then (a code change in development, a deploy in production). For those
// few seconds nothing listens on its port, and every call fails with "connection refused". That error
// means the request never reached the backend, so it is safe to simply try again, even for a change
// (nothing was done yet); any other failure is passed on untouched.
//
// Kept free of Next.js imports: proxy.ts uses it too.
const RETRY_DELAYS_MS = [250, 500, 1000, 1500, 2000]; // about 5 seconds in all

export function isConnectionRefused(error: unknown): boolean {
  return (error as { cause?: { code?: unknown } } | null)?.cause?.code === "ECONNREFUSED";
}

// fetch() that waits out a backend restart. Gives up (and throws the original error) after the delays above.
export async function fetchBackend(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (!isConnectionRefused(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
