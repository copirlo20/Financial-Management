import { z } from "zod";
import { STATEMENT_MAX_DAYS, statementDays, type StatementError } from "@fm/shared/reports";
import { dateText, idSchema } from "./common";

// Query of GET /api/reports/statement. Every refusal carries a StatementError code as its message.
const code = (error: StatementError) => ({ error });

export const statementQuerySchema = z
  .object({
    from: dateText.pipe(z.iso.date(code("invalid"))),
    to: dateText.pipe(z.iso.date(code("invalid"))),
    // Empty or missing: every account of the user.
    accountId: z
      .string()
      .optional()
      .transform((value) => value || null)
      .refine((value) => value === null || idSchema.safeParse(value).success, code("account")),
  })
  .refine((query) => query.from <= query.to, code("invalid"))
  .refine((query) => statementDays(query.from, query.to) <= STATEMENT_MAX_DAYS, code("range"));

export type StatementQuery = z.infer<typeof statementQuerySchema>;
