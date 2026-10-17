import { prisma } from "@fm/database";
import { getI18n } from "../i18n";

// Options for transaction forms and filters, always scoped to the given user.
export async function getTransactionOptions(userId: string) {
  const { t } = await getI18n();
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true, archivedAt: true },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ userId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      select: { id: true, name: true, type: true, parentId: true },
    }),
  ]);

  // Parents first, each followed by its children labelled "Parent › Child".
  const categoryOptions = categories
    .filter((category) => !category.parentId)
    .flatMap((parent) => [
      { id: parent.id, label: t(parent.name), type: parent.type },
      ...categories
        .filter((child) => child.parentId === parent.id)
        .map((child) => ({ id: child.id, label: `${t(parent.name)} › ${t(child.name)}`, type: child.type })),
    ]);

  return { accounts, categoryOptions };
}
