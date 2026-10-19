import { prisma } from "@fm/database";
import { aiProvider } from "../ai/client";
import { requireUser } from "../auth/current-user";
import { getTransactionOptions } from "../data/transaction-options";
import { readAnalysis } from "../imports/analysis";
import { suggestMapping } from "../imports/mapping";
import { parseStatementFile, type Cell } from "../imports/parse-file";
import { readImportFile } from "../imports/storage";
import { idSchema } from "../validations/common";

const HISTORY_LIMIT = 50;
const PREVIEW_ROWS = 20;
// Rows listed with their own category select before confirming; the rest keep the suggested category.
const REVIEW_ROWS = 100;

export async function importsView() {
  const user = await requireUser();

  const [accounts, batches] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    prisma.importBatch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        fileName: true,
        status: true,
        importedCount: true,
        skippedCount: true,
        createdAt: true,
        account: { select: { name: true } },
      },
    }),
  ]);
  return { accounts, batches, aiProvider: aiProvider() };
}
export type ImportsView = Awaited<ReturnType<typeof importsView>>;

async function loadTable(tempFileKey: string | null): Promise<Cell[][] | null> {
  if (!tempFileKey) return null;
  const file = await readImportFile(tempFileKey);
  if (!file) return null;
  try {
    return await parseStatementFile(file.buffer, file.extension);
  } catch {
    return null;
  }
}

// What the confirm step of a pending import needs: the category choices, and either the rows the
// assistant read or a preview of the file with a guessed column mapping.
async function pendingImport(userId: string, tempFileKey: string | null, aiAnalysis: unknown) {
  const { categoryOptions } = await getTransactionOptions(userId);
  const categoriesOf = (type: "EXPENSE" | "INCOME") =>
    categoryOptions.filter((category) => category.type === type).map(({ id, label }) => ({ value: id, label }));
  const [defaultExpense, defaultIncome] = await Promise.all(
    ["other_expense", "other_income"].map((systemKey) =>
      prisma.category.findFirst({ where: { systemKey }, select: { id: true } }),
    ),
  );
  const expenseCategories = categoriesOf("EXPENSE");
  const incomeCategories = categoriesOf("INCOME");
  const categoryDefaults = {
    expenseCategoryId: defaultExpense?.id ?? expenseCategories[0]?.value ?? "",
    incomeCategoryId: defaultIncome?.id ?? incomeCategories[0]?.value ?? "",
  };
  const choices = { expenseCategories, incomeCategories, categoryDefaults };

  const analysis = readAnalysis(aiAnalysis);
  if (analysis?.kind === "document") {
    return {
      ...choices,
      document: {
        rows: analysis.rows.slice(0, REVIEW_ROWS),
        totalRows: analysis.rows.length,
        errors: analysis.errors,
        categories: analysis.categories,
      },
      aiFailed: false,
      table: null,
    };
  }

  const table = await loadTable(tempFileKey);
  const suggestion = table && suggestMapping(table);
  return {
    ...choices,
    document: null,
    aiFailed: Boolean(analysis?.failed),
    // null when the uploaded file is no longer there: the import can then only be cancelled.
    table: table &&
      suggestion && {
        preview: table.slice(0, PREVIEW_ROWS),
        totalRows: table.length,
        columnCount: Math.max(...table.slice(0, 200).map((row) => row.length)),
        headerCells: table[suggestion.headerRow - 1] ?? [],
        suggestion,
      },
  };
}

export async function importView(batchId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(batchId);
  if (!id.success) return null;

  const found = await prisma.importBatch.findFirst({
    where: { id: id.data, userId: user.id },
    select: {
      id: true,
      fileName: true,
      status: true,
      tempFileKey: true,
      aiAnalysis: true,
      rowCount: true,
      importedCount: true,
      skippedCount: true,
      errorMessage: true,
      createdAt: true,
      account: { select: { id: true, name: true, currency: true } },
    },
  });
  if (!found) return null;

  const { tempFileKey, aiAnalysis, ...batch } = found;
  return {
    batch,
    pending: batch.status === "PENDING" ? await pendingImport(user.id, tempFileKey, aiAnalysis) : null,
  };
}
export type ImportView = NonNullable<Awaited<ReturnType<typeof importView>>>;
