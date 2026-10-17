-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('OUT', 'IN');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transferDirection" "TransferDirection",
ALTER COLUMN "amountInDefaultCurrency" DROP NOT NULL;

-- Custom: giao dịch TRANSFER (và chỉ TRANSFER) phải có transferGroupId và transferDirection.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_shape" CHECK (
  ("type" = 'TRANSFER') = ("transferGroupId" IS NOT NULL)
  AND ("type" = 'TRANSFER') = ("transferDirection" IS NOT NULL)
);

-- Custom: chuyển khoản không thuộc danh mục thu/chi nào.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_no_category" CHECK ("type" <> 'TRANSFER' OR "categoryId" IS NULL);
