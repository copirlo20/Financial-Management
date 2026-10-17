import { prisma } from "@fm/database";
import { positiveIntegerFromEnv } from "./env";
import { deleteImportFile, listImportFiles } from "./imports/storage";
import { pruneRateLimits } from "./rate-limit";
import { DAY_MS, HOUR_MS } from "./time";

// Housekeeping that runs while the backend is up: once shortly after start, then every hour
// (MAINTENANCE_INTERVAL_MS changes that; the tests make it short).
//
// An upload that is never confirmed or cancelled would otherwise keep the bank statement on disk, and
// the rows the assistant read in the database, for ever. After PENDING_IMPORT_TTL_MS both are removed,
// together with any statement file that no import refers to (left behind by a crash, for example).
const PENDING_IMPORT_TTL_MS = DAY_MS;

async function removeStaleImports(): Promise<{ batches: number; files: number }> {
  const cutoff = new Date(Date.now() - PENDING_IMPORT_TTL_MS);
  const stale = await prisma.importBatch.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, tempFileKey: true },
  });
  let batches = 0;
  let files = 0;
  for (const batch of stale) {
    // Re-checked in the delete, so an import confirmed in the meantime is left alone.
    const deleted = await prisma.importBatch.deleteMany({ where: { id: batch.id, status: "PENDING" } });
    if (deleted.count === 0) continue;
    batches += 1;
    if (batch.tempFileKey) {
      await deleteImportFile(batch.tempFileKey);
      files += 1;
    }
  }

  const referenced = new Set(
    (await prisma.importBatch.findMany({ where: { tempFileKey: { not: null } }, select: { tempFileKey: true } })).map(
      (batch) => batch.tempFileKey,
    ),
  );
  for (const file of await listImportFiles()) {
    if (!referenced.has(file.key) && file.modifiedAt < cutoff) {
      await deleteImportFile(file.key);
      files += 1;
    }
  }
  return { batches, files };
}

async function runOnce(): Promise<void> {
  try {
    const removed = await removeStaleImports();
    const counters = await pruneRateLimits();
    if (removed.batches || removed.files || counters) {
      console.log(`Maintenance: removed ${removed.batches} stale imports, ${removed.files} statement files, ${counters} old counters`);
    }
  } catch (error) {
    console.error("Maintenance failed", error instanceof Error ? error.message : error);
  }
}

export function startMaintenance(): void {
  const interval = positiveIntegerFromEnv("MAINTENANCE_INTERVAL_MS", HOUR_MS);
  setTimeout(runOnce, Math.min(interval, 30_000)).unref();
  setInterval(runOnce, interval).unref();
}
