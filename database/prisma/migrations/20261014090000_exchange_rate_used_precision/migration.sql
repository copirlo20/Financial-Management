-- AlterTable: tỷ giá chéo (ví dụ VND -> USD = 0.0000386) cần nhiều chữ số thập phân hơn để lưu chính xác.
ALTER TABLE "transactions" ALTER COLUMN "exchangeRateUsed" SET DATA TYPE DECIMAL(24,12);
