import { z } from "zod";
import { prisma } from "@fm/database";
import { dateToIsoDate, isoDateToDate } from "@fm/shared/dates";
import { currentMonth } from "@fm/shared/months";
import type { CurrentUser } from "../auth/current-user";
import { getBudgetStatuses } from "../data/budgets";
import { getMonthReport, getMonthlyTrend } from "../data/reports";
import { getI18n } from "../i18n";
import type { ChatTool } from "./model";

// What the chat assistant may look at. Every tool only reads, and only rows of the user it is given:
// the user comes from the session, never from the model's input.
const MAX_TRANSACTIONS = 50;
const MAX_TREND_MONTHS = 12;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MONTH_PARAM = { type: "string", description: "Month as YYYY-MM. Defaults to the current month." } as const;

const inputs = {
  get_month_summary: z.object({ month: month.optional() }),
  get_monthly_trend: z.object({ end_month: month.optional(), months: z.number().int().min(1).max(MAX_TREND_MONTHS).optional() }),
  get_budgets: z.object({ month: month.optional() }),
  list_transactions: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).optional(),
    category: z.string().max(100).optional(),
    search: z.string().max(100).optional(),
    sort: z.enum(["newest", "largest"]).optional(),
    limit: z.number().int().min(1).max(MAX_TRANSACTIONS).optional(),
  }),
  get_accounts: z.object({}),
  get_savings_goals: z.object({}),
};
type ToolName = keyof typeof inputs;

export const CHAT_TOOLS: ChatTool[] = [
  {
    name: "get_month_summary",
    description:
      "Income, spending and their difference for one month in the user's default currency, spending per top-level category, and the current total balance per currency.",
    parameters: { type: "object", properties: { month: MONTH_PARAM } },
  },
  {
    name: "get_monthly_trend",
    description: "Income and spending per month, in the user's default currency, for several consecutive months.",
    parameters: {
      type: "object",
      properties: {
        end_month: { type: "string", description: "Last month of the range as YYYY-MM. Defaults to the current month." },
        months: { type: "integer", description: `How many months, 1 to ${MAX_TREND_MONTHS}. Defaults to 6.` },
      },
    },
  },
  {
    name: "get_budgets",
    description: "The user's budgets for one month: limit, amount spent, percent used and whether each is ok, near or over its limit.",
    parameters: { type: "object", properties: { month: MONTH_PARAM } },
  },
  {
    name: "list_transactions",
    description: `Individual transactions, at most ${MAX_TRANSACTIONS} per call, with the total number that matched. Use it for questions about specific payments, the largest ones, or a period that is not a whole month.`,
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "First date, YYYY-MM-DD." },
        to: { type: "string", description: "Last date, YYYY-MM-DD." },
        type: { type: "string", enum: ["EXPENSE", "INCOME", "TRANSFER"] },
        category: { type: "string", description: "Part of a category name, as the user sees it." },
        search: { type: "string", description: "Text to look for in the transaction note." },
        sort: { type: "string", enum: ["newest", "largest"], description: "Defaults to newest." },
        limit: { type: "integer", description: `1 to ${MAX_TRANSACTIONS}. Defaults to 20.` },
      },
    },
  },
  {
    name: "get_accounts",
    description: "The user's accounts and wallets with their type, currency and current balance.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_savings_goals",
    description: "The user's savings goals: target, amount saved so far, deadline and status.",
    parameters: { type: "object", properties: {} },
  },
];

async function listTransactions(user: CurrentUser, input: z.infer<typeof inputs.list_transactions>) {
  const { t } = await getI18n();
  let categoryIds: string[] | undefined;
  if (input.category) {
    // Category names are shown translated, so the match has to run on what the user sees.
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId: user.id }, { userId: null }] },
      select: { id: true, name: true, parentId: true },
    });
    const wanted = input.category.toLowerCase();
    const matched = new Set(categories.filter((category) => t(category.name).toLowerCase().includes(wanted)).map((category) => category.id));
    categoryIds = categories.filter((category) => matched.has(category.id) || (category.parentId && matched.has(category.parentId))).map((category) => category.id);
  }

  const where = {
    userId: user.id,
    type: input.type,
    date: { gte: input.from ? isoDateToDate(input.from) : undefined, lte: input.to ? isoDateToDate(input.to) : undefined },
    categoryId: categoryIds ? { in: categoryIds } : undefined,
    note: input.search ? { contains: input.search, mode: "insensitive" as const } : undefined,
  };
  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: input.sort === "largest" ? [{ amountInDefaultCurrency: { sort: "desc", nulls: "last" } }, { date: "desc" }] : [{ date: "desc" }, { createdAt: "desc" }],
      take: input.limit ?? 20,
      select: {
        date: true,
        type: true,
        amount: true,
        currency: true,
        amountInDefaultCurrency: true,
        note: true,
        transferDirection: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
  ]);
  return {
    totalMatching: total,
    defaultCurrency: user.defaultCurrency,
    transactions: rows.map((row) => ({
      date: dateToIsoDate(row.date),
      type: row.type,
      amount: row.amount.toString(),
      currency: row.currency,
      amountInDefaultCurrency: row.amountInDefaultCurrency?.toString() ?? null,
      category: row.category ? t(row.category.name) : null,
      account: row.account.name,
      transferDirection: row.transferDirection,
      note: row.note,
    })),
  };
}

const handlers: { [Name in ToolName]: (user: CurrentUser, input: z.infer<(typeof inputs)[Name]>) => Promise<unknown> } = {
  async get_month_summary(user, input) {
    const report = await getMonthReport(user.id, input.month ?? currentMonth());
    return {
      month: input.month ?? currentMonth(),
      currency: user.defaultCurrency,
      income: report.income.toString(),
      expense: report.expense.toString(),
      net: report.net.toString(),
      expenseByCategory: report.expenseByCategory.map((entry) => ({ category: entry.name, total: entry.total.toString() })),
      transactionsLeftOutForMissingExchangeRate: report.unconvertedCount,
      currentBalances: report.balances.map((balance) => ({ currency: balance.currency, total: balance.total.toString() })),
    };
  },
  async get_monthly_trend(user, input) {
    const trend = await getMonthlyTrend(user.id, input.end_month ?? currentMonth(), input.months ?? 6);
    return {
      currency: user.defaultCurrency,
      months: trend.map((point) => ({ month: point.month, income: point.income.toString(), expense: point.expense.toString() })),
    };
  },
  async get_budgets(user, input) {
    const { statuses, unconvertedCount } = await getBudgetStatuses(user.id, input.month ?? currentMonth());
    return {
      month: input.month ?? currentMonth(),
      budgets: statuses.map((budget) => ({
        name: budget.name,
        currency: budget.currency,
        limit: budget.limit.toString(),
        spent: budget.spent.toString(),
        percentUsed: Math.round(budget.percent),
        state: budget.state,
      })),
      transactionsLeftOutForMissingExchangeRate: unconvertedCount,
    };
  },
  list_transactions: listTransactions,
  async get_accounts(user) {
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { name: true, type: true, currency: true, currentBalance: true, archivedAt: true },
    });
    return accounts.map((account) => ({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.currentBalance.toString(),
      archived: account.archivedAt !== null,
    }));
  },
  async get_savings_goals(user) {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { name: true, targetAmount: true, currentAmount: true, currency: true, deadline: true, status: true },
    });
    return goals.map((goal) => ({
      name: goal.name,
      currency: goal.currency,
      target: goal.targetAmount.toString(),
      saved: goal.currentAmount.toString(),
      percent: Math.round(goal.currentAmount.div(goal.targetAmount).mul(100).toNumber()),
      deadline: goal.deadline ? dateToIsoDate(goal.deadline) : null,
      status: goal.status,
    }));
  },
};

// Runs one tool call for `user`. The result (or the reason it failed) goes back to the model as JSON text.
export async function runChatTool(user: CurrentUser, name: string, input: unknown): Promise<{ content: string; isError: boolean }> {
  if (!(name in inputs)) return { content: "Unknown tool.", isError: true };
  const toolName = name as ToolName;
  const parsed = inputs[toolName].safeParse(input ?? {});
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`, isError: true };
  try {
    const run = handlers[toolName] as (user: CurrentUser, input: unknown) => Promise<unknown>;
    return { content: JSON.stringify(await run(user, parsed.data)), isError: false };
  } catch (error) {
    console.error("Chat tool failed", toolName, error instanceof Error ? error.message : error);
    return { content: "The data could not be loaded.", isError: true };
  }
}
