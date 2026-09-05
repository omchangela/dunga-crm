-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "allocations" JSONB NOT NULL DEFAULT '[]';
