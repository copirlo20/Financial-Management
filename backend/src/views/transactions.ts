import { prisma, type Prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { requireUser } from "../auth/current-user";
import { getTransactionOptions } from "../data/transaction-options";
import { idSchema } from "../validations/common";
import { transactionFilterSchema } from "../validations/transaction";

const PAGE_SIZE = 20;

export async function transactionsView(query: unknown) {
  const user = await requireUser();
  const filter = transactionFilterSchema.parse(query);

  const where: Prisma.TransactionWhereInput = {
    userId: user.id,
    accountId: filter.accountId,
    categoryId: filter.categoryId,
    type: filter.type,
    date: {
      gte: filter.from ? isoDateToDate(filter.from) : undefined,
      lte: filter.to ? isoDateToDate(filter.to) : undefined,
    },
  };
  const [{ accounts, categoryOptions }, total, transactions] = await Promise.all([
    getTransactionOptions(user.id),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        transferDirection: true,
        transferGroupId: true,
        amount: true,
        currency: true,
        date: true,
        note: true,
        account: { select: { name: true } },
        category: { select: { name: true, icon: true, color: true } },
      },
    }),
  ]);

  // The other side of each transfer on this page, to label rows "to X" / "from Y".
  const groupIds = transactions.flatMap((row) => (row.transferGroupId ? [row.transferGroupId] : []));
  const transferSides = groupIds.length
    ? await prisma.transaction.findMany({
        where: { userId: user.id, transferGroupId: { in: groupIds } },
        select: { transferGroupId: true, transferDirection: true, account: { select: { name: true } } },
      })
    : [];

  return { filter, pageSize: PAGE_SIZE, accounts, categoryOptions, total, transactions, transferSides };
}
export type TransactionsView = Awaited<ReturnType<typeof transactionsView>>;

// An income or expense entry to edit (transfers are not edited), with the choices for its form.
export async function transactionView(transactionId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(transactionId);
  if (!id.success) return null;

  const [transaction, { accounts, categoryOptions }] = await Promise.all([
    prisma.transaction.findFirst({
      where: { id: id.data, userId: user.id, type: { in: ["EXPENSE", "INCOME"] } },
      select: { id: true, type: true, accountId: true, categoryId: true, amount: true, date: true, note: true },
    }),
    getTransactionOptions(user.id),
  ]);
  if (!transaction) return null;

  return { transaction, accounts, categoryOptions };
}
export type TransactionView = NonNullable<Awaited<ReturnType<typeof transactionView>>>;
