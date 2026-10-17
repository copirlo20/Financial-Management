-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "systemKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "categories_systemKey_key" ON "categories"("systemKey");

-- Custom: category hệ thống (userId NULL) bắt buộc có systemKey; category của user thì không được có.
ALTER TABLE "categories" ADD CONSTRAINT "categories_systemKey_iff_system" CHECK (("userId" IS NULL) = ("systemKey" IS NOT NULL));
