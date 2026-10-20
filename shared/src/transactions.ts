// Amounts are stored positive; which way the money went comes from the type, and for a transfer from its side.
export type Movement = { type: string; transferDirection: string | null };

// Money coming into an account: income, or the receiving side of a transfer.
export function isInflow(row: Movement): boolean {
  return row.type === "INCOME" || (row.type === "TRANSFER" && row.transferDirection === "IN");
}
