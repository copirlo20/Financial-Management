// The part of a query that finds another record with this name: the same letters whatever their case,
// leaving out the record being renamed (exceptId). Accounts, savings goals and categories each keep their
// names unique in this sense.
export function sameName(name: string, exceptId?: string) {
  return { name: { equals: name, mode: "insensitive" as const }, ...(exceptId ? { id: { not: exceptId } } : {}) };
}
