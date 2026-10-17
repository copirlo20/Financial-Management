-- AlterTable: each existing token becomes its own session (it has always been one sign-in).
ALTER TABLE "refresh_tokens" ADD COLUMN "sessionId" TEXT;
UPDATE "refresh_tokens" SET "sessionId" = "id";
ALTER TABLE "refresh_tokens" ALTER COLUMN "sessionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");
