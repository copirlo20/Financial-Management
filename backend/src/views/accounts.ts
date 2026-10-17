import { Prisma, prisma } from "@fm/database";
import { requireUser } from "../auth/current-user";
import { convertBalances, refreshRates } from "../exchange";
import { idSchema } from "../validations/common";

export async function accountsView() {
  const user = await requireUser();

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true, currency: true, currentBalance: true, archivedAt: true },
    }),
    prisma.account.groupBy({
      by: ["currency"],
      where: { userId: user.id, archivedAt: null },
      _sum: { currentBalance: true },
      orderBy: { currency: "asc" },
    }),
  ]);
  const totals = sums.map((sum) => ({ currency: sum.currency, total: sum._sum.currentBalance ?? new Prisma.Decimal(0) }));
  // Only worth a combined figure when there is something to combine.
  const converted = totals.some((total) => total.currency !== user.defaultCurrency)
    ? (await refreshRates(), await convertBalances(totals, user.defaultCurrency))
    : null;

  return { accounts, totals, converted };
}
export type AccountsView = Awaited<ReturnType<typeof accountsView>>;

export async function accountView(accountId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(accountId);
  if (!id.success) return null;

  return prisma.account.findFirst({
    where: { id: id.data, userId: user.id },
    select: { id: true, name: true, type: true, currency: true, initialBalance: true },
  });
}
export type AccountView = NonNullable<Awaited<ReturnType<typeof accountView>>>;
