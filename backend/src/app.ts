import express, { type ErrorRequestHandler, type Request } from "express";
import { DEFAULT_LOCALE, isLocale } from "@fm/shared/i18n/config";
import { CLIENT_IP_HEADER, LOCALE_HEADER, REFRESH_TOKEN_HEADER } from "@fm/shared/wire";
import { loadUser } from "./auth/current-user";
import { runWithContext } from "./http/context";
import { HttpError } from "./http/errors";
import { apiRoutes } from "./routes";

// Statement uploads are capped at 5 MB in imports/parse-file.ts; the rest is headroom so that an
// oversized file gets the handler's own message rather than a bare "too large".
const UPLOAD_LIMIT = "6mb";

function bearerToken(req: Request): string | null {
  const header = req.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

// Express tells an error handler from other middleware by its four parameters, so the last one stays.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  // Statuses set by Express itself (malformed JSON, body too large) arrive as error.status.
  const status =
    error instanceof HttpError ? error.status : typeof error?.status === "number" && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  if (res.headersSent) return res.end();
  // Messages of deliberate errors are safe to show; anything unexpected stays in the log.
  res.status(status).json({ message: error instanceof HttpError ? error.message : status === 500 ? "Internal error" : "Bad request" });
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // Bodies are read before the request context starts, so the context is never lost to a parser's callbacks.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.raw({ type: "application/octet-stream", limit: UPLOAD_LIMIT }));

  // Who is calling and in which language; available to everything below through http/context.ts.
  app.use(async (req, _res, next) => {
    const locale = req.get(LOCALE_HEADER);
    const token = bearerToken(req);
    const signedIn = token ? await loadUser(token) : null;
    runWithContext(
      {
        user: signedIn?.user ?? null,
        sessionId: signedIn?.sessionId ?? null,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        // Trusted because only the frontend can reach the backend (it listens on 127.0.0.1).
        clientIp: req.get(CLIENT_IP_HEADER)?.trim().slice(0, 64) || null,
        refreshToken: req.get(REFRESH_TOKEN_HEADER),
        effects: {},
      },
      next,
    );
  });

  app.use("/api", apiRoutes());
  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use(handleError);
  return app;
}
