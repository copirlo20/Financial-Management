import type { Request, Router } from "express";
import type { CommandResult } from "@fm/shared/wire";
import { requestContext } from "./context";
import { HttpError } from "./errors";
import { RedirectSignal } from "./respond";
import { encode } from "./wire";

// The handlers were written against the browser's FormData, so a command's JSON body
// ({ fields: [[name, value], ...] }) is turned back into one. Route parameters (":id") are added as
// fields of the same name, which is where handlers taking the id from the form look for it.
function toFormData(body: unknown, params: Record<string, unknown>): FormData {
  const form = new FormData();
  const fields = (body as { fields?: unknown } | undefined)?.fields;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (Array.isArray(field) && typeof field[0] === "string" && typeof field[1] === "string") form.append(field[0], field[1]);
    }
  }
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string") form.set(name, value);
  }
  return form;
}

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

type Method = "post" | "put" | "patch" | "delete";
type CommandHandler = (form: FormData, req: Request) => Promise<unknown>;

// A route that changes something. What the handler returns goes back to the form as `state`;
// redirect(), setSessionTokens() and setLocale() called inside it travel alongside.
export function command(router: Router, method: Method, path: string, handler: CommandHandler): void {
  router[method](path, async (req, res) => {
    const result: CommandResult = {};
    try {
      result.state = encode(await handler(toFormData(req.body, req.params), req));
    } catch (error) {
      if (!(error instanceof RedirectSignal)) throw error;
      result.redirect = error.path;
    }
    res.json({ ...result, ...requestContext().effects });
  });
}

// A route that reads. null or undefined from the loader means "no such thing (for this user)".
export function view(router: Router, path: string, loader: (req: Request) => Promise<unknown>): void {
  router.get(path, async (req, res) => {
    const data = await loader(req);
    if (data === null || data === undefined) throw new HttpError(404, "Not found");
    res.json(encode(data));
  });
}
