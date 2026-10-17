import { Router, type Request } from "express";
import { requireUser } from "./auth/current-user";
import { rotateRefreshToken } from "./auth/session";
import * as accounts from "./handlers/accounts";
import * as adminCategories from "./handlers/admin-categories";
import * as adminRates from "./handlers/admin-exchange-rates";
import * as auth from "./handlers/auth";
import * as budgets from "./handlers/budgets";
import * as categories from "./handlers/categories";
import { chat } from "./handlers/chat";
import * as imports from "./handlers/imports";
import * as savings from "./handlers/savings";
import * as settings from "./handlers/settings";
import * as transactions from "./handlers/transactions";
import { HttpError } from "./http/errors";
import { command, routeParam, view } from "./http/routing";
import { buildCsvTemplate, buildXlsxTemplate } from "./imports/template";
import { hit } from "./rate-limit";
import { buildStatement } from "./reports/statement";
import { renderStatementPdf } from "./reports/statement-pdf";
import { accountView, accountsView } from "./views/accounts";
import { budgetView, budgetsView } from "./views/budgets";
import { adminCategoriesView, adminCategoryView, categoriesView, categoryView } from "./views/categories";
import { adminExchangeRatesView } from "./views/exchange-rates";
import { importView, importsView } from "./views/imports";
import { dashboardView, sessionView, settingsView } from "./views/overview";
import { savingsGoalView, savingsView } from "./views/savings";
import { statementQuerySchema } from "./validations/report";
import { transactionView, transactionsView } from "./views/transactions";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Building a statement reads a period of transactions and draws a PDF, so each user gets a few per hour.
const STATEMENTS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;
const id = (req: Request) => routeParam(req, "id");

// Every route of the API, mounted under /api. view() routes read, command() routes change something
// (see http/routing.ts). Who may do what is decided inside each view and handler, never here.
export function apiRoutes(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ---------- Session ----------
  command(router, "post", "/auth/register", (form) => auth.register(undefined, form));
  command(router, "post", "/auth/login", (form) => auth.login(undefined, form));
  command(router, "post", "/auth/logout", () => auth.logout());
  command(router, "post", "/auth/logout-everywhere", () => auth.logoutEverywhere());
  // Called by the frontend when the access token has run out. Not a command(): the answer is only tokens.
  router.post("/auth/refresh", async (req, res) => {
    const refreshToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
    const tokens = typeof refreshToken === "string" ? await rotateRefreshToken(refreshToken) : null;
    if (!tokens) throw new HttpError(401, "Not signed in");
    res.json({ tokens });
  });
  view(router, "/me", () => sessionView());

  // ---------- Overview and settings ----------
  view(router, "/dashboard", (req) => dashboardView(req.query));
  view(router, "/settings", () => settingsView());
  command(router, "put", "/settings", (form) => settings.updateSettings(undefined, form));
  command(router, "post", "/settings/language", (form) => settings.setLanguage(form));
  command(router, "put", "/settings/password", (form) => settings.changePassword(undefined, form));
  command(router, "post", "/settings/exchange-rates/refresh", () => settings.refreshExchangeRates());

  // ---------- Accounts ----------
  view(router, "/accounts", () => accountsView());
  view(router, "/accounts/:id", (req) => accountView(id(req)));
  command(router, "post", "/accounts", (form) => accounts.createAccount(undefined, form));
  command(router, "put", "/accounts/:id", (form, req) => accounts.updateAccount(id(req), undefined, form));
  command(router, "post", "/accounts/:id/archive", (form) => accounts.archiveAccount(form));
  command(router, "post", "/accounts/:id/restore", (form) => accounts.restoreAccount(form));

  // ---------- Categories ----------
  view(router, "/categories", () => categoriesView());
  view(router, "/categories/:id", (req) => categoryView(id(req)));
  command(router, "post", "/categories", (form) => categories.createCategory(undefined, form));
  command(router, "put", "/categories/:id", (form, req) => categories.updateCategory(id(req), undefined, form));
  command(router, "delete", "/categories/:id", (form) => categories.deleteCategory(undefined, form));

  // ---------- Transactions ----------
  view(router, "/transactions", (req) => transactionsView(req.query));
  view(router, "/transactions/:id", (req) => transactionView(id(req)));
  command(router, "post", "/transactions", (form) => transactions.createTransaction(undefined, form));
  command(router, "put", "/transactions/:id", (form, req) => transactions.updateTransaction(id(req), undefined, form));
  command(router, "delete", "/transactions/:id", (form) => transactions.deleteTransaction(form));
  command(router, "post", "/transfers", (form) => transactions.createTransfer(undefined, form));

  // ---------- Budgets ----------
  view(router, "/budgets", (req) => budgetsView(req.query));
  view(router, "/budgets/:id", (req) => budgetView(id(req)));
  command(router, "post", "/budgets", (form) => budgets.createBudget(undefined, form));
  command(router, "post", "/budgets/copy-previous", (form) => budgets.copyPreviousMonthBudgets(form));
  command(router, "put", "/budgets/:id", (form, req) => budgets.updateBudget(id(req), undefined, form));
  command(router, "delete", "/budgets/:id", (form) => budgets.deleteBudget(form));

  // ---------- Savings goals ----------
  view(router, "/savings", () => savingsView());
  view(router, "/savings/:id", (req) => savingsGoalView(id(req)));
  command(router, "post", "/savings", (form) => savings.createGoal(undefined, form));
  command(router, "put", "/savings/:id", (form, req) => savings.updateGoal(id(req), undefined, form));
  command(router, "delete", "/savings/:id", (form) => savings.deleteGoal(form));
  command(router, "post", "/savings/:id/archive", (form) => savings.archiveGoal(form));
  command(router, "post", "/savings/:id/restore", (form) => savings.restoreGoal(form));
  command(router, "post", "/savings/:id/contributions", (form, req) => savings.addContribution(id(req), undefined, form));
  command(router, "delete", "/savings/contributions/:id", (form) => savings.deleteContribution(undefined, form));

  // ---------- Account statement (PDF) ----------
  // Refusals answer with a StatementError code (see @fm/shared/reports) as the message.
  router.get("/reports/statement", async (req, res) => {
    const user = await requireUser();
    const query = statementQuerySchema.safeParse(req.query);
    if (!query.success) {
      const code = query.error.issues.find((issue) => issue.message === "range" || issue.message === "account")?.message ?? "invalid";
      throw new HttpError(code === "account" ? 404 : 400, code);
    }
    if ((await hit(`statement:${user.id}`, HOUR_MS)) > STATEMENTS_PER_HOUR) throw new HttpError(429, "busy");
    const pdf = await renderStatementPdf(await buildStatement(user, query.data));
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sao-ke-${query.data.from}_${query.data.to}.pdf"`,
        "Cache-Control": "private, no-store",
      })
      .send(pdf);
  });

  // ---------- Statement imports ----------
  view(router, "/imports", () => importsView());
  router.get("/imports/template", async (req, res) => {
    await requireUser();
    const format = req.query.format;
    if (format !== "csv" && format !== "xlsx") throw new HttpError(400, "Unknown format");
    const body = format === "csv" ? buildCsvTemplate() : await buildXlsxTemplate();
    res
      .set({
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : XLSX_TYPE,
        "Content-Disposition": `attachment; filename="mau-sao-ke.${format}"`,
        "Cache-Control": "private, no-store",
      })
      .send(Buffer.from(body));
  });
  view(router, "/imports/:id", (req) => importView(id(req)));
  // The file is the request body (application/octet-stream); its name and the form's other fields
  // come as a header and query parameters.
  command(router, "post", "/imports", (form, req) => {
    const bytes = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array();
    form.set("file", new File([bytes], decodeURIComponent(req.get("x-file-name") ?? "")));
    for (const name of ["accountId", "useAi"]) {
      const value = req.query[name];
      if (typeof value === "string") form.set(name, value);
    }
    return imports.uploadImport(undefined, form);
  });
  command(router, "post", "/imports/:id/confirm", (form, req) => imports.confirmImport(id(req), undefined, form));
  command(router, "post", "/imports/:id/confirm-document", (form, req) =>
    imports.confirmDocumentImport(id(req), undefined, form),
  );
  command(router, "post", "/imports/:id/cancel", (form) => imports.cancelImport(form));
  command(router, "post", "/imports/:id/rollback", (form) => imports.rollbackImport(undefined, form));
  command(router, "delete", "/imports/:id", (form) => imports.deleteImport(undefined, form));

  // ---------- Administration ----------
  view(router, "/admin/categories", () => adminCategoriesView());
  view(router, "/admin/categories/:id", (req) => adminCategoryView(id(req)));
  command(router, "post", "/admin/categories", (form) => adminCategories.createSystemCategory(undefined, form));
  command(router, "put", "/admin/categories/:id", (form, req) =>
    adminCategories.updateSystemCategory(id(req), undefined, form),
  );
  command(router, "delete", "/admin/categories/:id", (form) => adminCategories.deleteSystemCategory(undefined, form));
  view(router, "/admin/exchange-rates", () => adminExchangeRatesView());
  command(router, "post", "/admin/exchange-rates", (form) => adminRates.setManualRate(undefined, form));
  command(router, "delete", "/admin/exchange-rates/:id", (form) => adminRates.deleteManualRate(form));

  // ---------- Chat assistant ----------
  router.post("/chat", chat);

  return router;
}
