import { prisma, Prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { STATEMENT_MAX_ROWS } from "@fm/shared/reports";
import type { CurrentUser } from "../auth/current-user";
import { exchangeRate } from "../exchange";
import { HttpError } from "../http/errors";
import { getI18n } from "../i18n";
import type { StatementQuery } from "../validations/report";

// The figures of an account statement for one period, laid out like a bank's: the balance before the
// period, money out (debit) and money in (credit) during it, and the balance after it.
//
// One account: everything in that account's currency, so the statement matches its balance exactly.
// All accounts: everything in the user's default currency. Transactions use the amount converted on their
// own date (as the rest of the app does); the accounts' opening amounts are converted at the rate of the
// first day of the period. Transfers between the user's own accounts show on both sides.

export type StatementRow = {
  date: Date;
  recordedAt: Date;
  amount: Prisma.Decimal;
  currency: string;
  // In the statement's currency; both null for a transaction that has no exchange rate yet (all accounts only).
  debit: Prisma.Decimal | null;
  credit: Prisma.Decimal | null;
  description: string;
};

export type Statement = {
  holder: { name: string; email: string };
  createdAt: Date;
  from: string;
  to: string;
  account: { name: string; currency: string } | null;
  currency: string;
  opening: Prisma.Decimal;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  closing: Prisma.Decimal;
  rows: StatementRow[];
  // All accounts only: transactions up to the end of the period left out for lack of an exchange rate,
  // and currencies whose accounts' opening amounts could not be converted.
  unconverted: number;
  missingRates: string[];
};

const ZERO = new Prisma.Decimal(0);

type Movement = { type: string; transferDirection: string | null };
const isInflow = (row: Movement) => row.type === "INCOME" || (row.type === "TRANSFER" && row.transferDirection === "IN");

export async function buildStatement(user: CurrentUser, query: StatementQuery): Promise<Statement> {
  const { t } = await getI18n();
  const start = isoDateToDate(query.from);
  const end = isoDateToDate(query.to);

  const account = query.accountId
    ? await prisma.account.findFirst({
        where: { id: query.accountId, userId: user.id },
        select: { id: true, name: true, currency: true, initialBalance: true },
      })
    : null;
  if (query.accountId && !account) throw new HttpError(404, "account");
  const currency = account?.currency ?? user.defaultCurrency;
  const scope = { userId: user.id, ...(account ? { accountId: account.id } : {}) };

  const rows = await prisma.transaction.findMany({
    where: { ...scope, date: { gte: start, lte: end } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: STATEMENT_MAX_ROWS + 1,
    select: {
      type: true,
      amount: true,
      currency: true,
      amountInDefaultCurrency: true,
      date: true,
      createdAt: true,
      note: true,
      transferGroupId: true,
      transferDirection: true,
      category: { select: { name: true } },
      account: { select: { name: true } },
    },
  });
  if (rows.length > STATEMENT_MAX_ROWS) throw new HttpError(400, "rows");

  // The balance before the period: the accounts' opening amounts plus every earlier transaction.
  const before = await prisma.transaction.groupBy({
    by: ["type", "transferDirection"],
    where: { ...scope, date: { lt: start } },
    _sum: { amount: true, amountInDefaultCurrency: true },
  });
  let opening = ZERO;
  const missingRates: string[] = [];
  if (account) {
    opening = account.initialBalance;
  } else {
    const accounts = await prisma.account.groupBy({ by: ["currency"], where: { userId: user.id }, _sum: { initialBalance: true } });
    for (const group of accounts) {
      const amount = group._sum.initialBalance ?? ZERO;
      if (amount.isZero()) continue;
      const rate = await exchangeRate(prisma, group.currency, currency, start);
      if (rate) opening = opening.plus(amount.mul(rate).toDecimalPlaces(2));
      else missingRates.push(group.currency);
    }
  }
  for (const group of before) {
    const amount = (account ? group._sum.amount : group._sum.amountInDefaultCurrency) ?? ZERO;
    opening = isInflow(group) ? opening.plus(amount) : opening.minus(amount);
  }
  const unconverted = account
    ? 0
    : await prisma.transaction.count({ where: { userId: user.id, date: { lte: end }, amountInDefaultCurrency: null } });

  // The other account of each transfer, for "to X" / "from Y".
  const groupIds = [...new Set(rows.map((row) => row.transferGroupId).filter((id): id is string => id !== null))];
  const sides = groupIds.length
    ? await prisma.transaction.findMany({
        where: { userId: user.id, transferGroupId: { in: groupIds } },
        select: { transferGroupId: true, transferDirection: true, account: { select: { name: true } } },
      })
    : [];
  const otherSide = (groupId: string | null, direction: string | null) =>
    sides.find((side) => side.transferGroupId === groupId && side.transferDirection !== direction)?.account.name ?? "?";

  let debit = ZERO;
  let credit = ZERO;
  const statementRows = rows.map((row): StatementRow => {
    const value = account ? row.amount : row.amountInDefaultCurrency;
    const inflow = isInflow(row);
    if (value) {
      if (inflow) credit = credit.plus(value);
      else debit = debit.plus(value);
    }
    const title =
      row.type === "TRANSFER"
        ? row.transferDirection === "OUT"
          ? t("Chuyển đến {0}", otherSide(row.transferGroupId, row.transferDirection))
          : t("Nhận từ {0}", otherSide(row.transferGroupId, row.transferDirection))
        : row.category
          ? t(row.category.name)
          : t("Chưa phân loại");
    const parts = [title, row.note?.replace(/\s+/g, " ").trim()].filter(Boolean).join(" - ");
    return {
      date: row.date,
      recordedAt: row.createdAt,
      amount: row.amount,
      currency: row.currency,
      debit: value && !inflow ? value : null,
      credit: value && inflow ? value : null,
      description: account ? parts : `${parts} (${row.account.name})`,
    };
  });

  return {
    holder: { name: user.name, email: user.email },
    createdAt: new Date(),
    from: query.from,
    to: query.to,
    account: account ? { name: account.name, currency: account.currency } : null,
    currency,
    opening,
    debit,
    credit,
    closing: opening.plus(credit).minus(debit),
    rows: statementRows,
    unconverted,
    missingRates,
  };
}
