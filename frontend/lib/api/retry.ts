// The backend is restarted now and then (a code change in development, a deploy in production). For those
// few seconds the calls to it fail in one of two ways:
//
// - "connection refused" (ECONNREFUSED): nothing listens on the port yet. The request never reached the
//   backend, so it is safe to try again, even for a change (nothing was done yet).
// - "connection reset" (ECONNRESET): the connection was cut while it was in use, because the backend went
//   down, or closed an idle connection just as it was being reused. The request may or may not have been
//   processed, so it is tried again only when repeating it changes nothing (a read: GET or HEAD).
//
// Any other failure is passed on untouched.
//
// Kept free of Next.js imports: proxy.ts uses it too.
const RETRY_DELAYS_MS = [250, 500, 1000, 1500, 2000]; // about 5 seconds in all

function causeCode(error: unknown): unknown {
  return (error as { cause?: { code?: unknown } } | null)?.cause?.code;
}

export function isConnectionRefused(error: unknown): boolean {
  return causeCode(error) === "ECONNREFUSED";
}

export function isConnectionReset(error: unknown): boolean {
  return causeCode(error) === "ECONNRESET";
}

function isRead(init: RequestInit): boolean {
  const method = (init.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

// fetch() that waits out a backend restart. Gives up after the delays above with an error that says which
// address did not answer (the original is kept as its cause); any other failure is thrown as it is.
export async function fetchBackend(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (!isConnectionRefused(error) && !(isConnectionReset(error) && isRead(init))) throw error;
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw new Error(
          `Backend not reachable at ${new URL(url).origin} (connection refused or reset for ~5 s). ` +
            `Is it running? Look for "[backend]" errors above this one.`,
          { cause: error },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
