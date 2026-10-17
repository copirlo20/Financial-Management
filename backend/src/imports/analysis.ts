import { z } from "zod";

// Row number (as text) -> category id the assistant suggested for that row.
const rowCategories = z.record(z.string(), z.string());

const analysisSchema = z.discriminatedUnion("kind", [
  // A spreadsheet the assistant was asked to read but could not: it is mapped by hand instead.
  z.object({ kind: z.literal("table"), failed: z.boolean().optional() }),
  // The assistant read the file (a PDF, or every row of a spreadsheet): its rows are the data to import.
  z.object({
    kind: z.literal("document"),
    rows: z.array(
      z.object({
        rowNumber: z.number().int(),
        date: z.string(),
        type: z.enum(["EXPENSE", "INCOME"]),
        amount: z.string(),
        description: z.string(),
      }),
    ),
    errors: z.array(z.object({ rowNumber: z.number().int(), message: z.string() })),
    categories: rowCategories,
  }),
]);

export type ImportAnalysis = z.infer<typeof analysisSchema>;

// Reads ImportBatch.aiAnalysis; anything that is not a stored analysis counts as "no analysis".
export function readAnalysis(value: unknown): ImportAnalysis | null {
  const parsed = analysisSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
