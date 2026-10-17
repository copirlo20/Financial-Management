// The backend is restarted now and then (a code change in development, a deploy in production). For those
// few seconds the calls to it fail in one of two ways:
//
// - "connection refused" (ECONNREFUSED): nothing listens on the port yet. The request never reached the
//   backend, so it is safe to try again, even for a change (nothing was done yet).
// - the connection was cut while in use (ECONNRESET, or undici's "other side closed", UND_ERR_SOCKET):
//   the backend went down mid-request, or the connection was one left over from before the restart. The
//   request may or may not have been processed, so it is tried again only for a read (GET or HEAD).
//
// Any other failure is passed on untouched.
//
// Kept free of Next.js imports: proxy.ts uses it too.
const RETRY_DELAYS_MS = [250, 500, 1000, 1500, 2000]; // about 5 seconds in all

const CUT_CONNECTION = new Set(["ECONNRESET", "UND_ERR_SOCKET"]);

function errorCode(error: unknown): unknown {
  return (error as { cause?: { code?: unknown } } | null)?.cause?.code;
}

function isCutConnection(error: unknown): boolean {
  const code = errorCode(error);
  return typeof code === "string" && CUT_CONNECTION.has(code);
}

function retryable(error: unknown, init: RequestInit): boolean {
  if (errorCode(error) === "ECONNREFUSED") return true;
  const method = (init.method ?? "GET").toUpperCase();
  return isCutConnection(error) && (method === "GET" || method === "HEAD");
}

// The backend could not be talked to. mayHaveRun tells the two cases apart: false when it never got the
// request (nothing was done), true when a change was cut off on its way (it may or may not have been made).
export class BackendConnectionError extends Error {
  constructor(
    message: string,
    readonly mayHaveRun: boolean,
    options: { cause: unknown },
  ) {
    super(message, options);
    this.name = "BackendConnectionError";
  }
}

// fetch() that waits out a backend restart. Gives up after the delays above, and at once for a change whose
// connection was cut, with a BackendConnectionError that says what happened (the original is kept as its
// cause); any other failure is thrown as it is.
export async function fetchBackend(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      // While a page renders, Next.js hands every GET of the same URL the promise of the first one, even
      // once it has failed, so a plain retry would only get the same error back again. A signal of its own
      // is how Next.js lets a call opt out of that, so each retry really goes out.
      return await fetch(url, attempt === 0 || init.signal ? init : { ...init, signal: new AbortController().signal });
    } catch (error) {
      if (!retryable(error, init)) {
        if (!isCutConnection(error)) throw error;
        const { origin, pathname } = new URL(url);
        throw new BackendConnectionError(
          `The connection to the backend at ${origin} was cut during ${(init.method ?? "GET").toUpperCase()} ${pathname}. ` +
            `Not sent again: the change may already have been made. Look for "[backend]" lines above this one.`,
          true,
          { cause: error },
        );
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw new BackendConnectionError(
          `Backend not reachable at ${new URL(url).origin} (connection refused or cut for ~5 s). ` +
            `Is it running? Look for "[backend]" errors above this one.`,
          false,
          { cause: error },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
