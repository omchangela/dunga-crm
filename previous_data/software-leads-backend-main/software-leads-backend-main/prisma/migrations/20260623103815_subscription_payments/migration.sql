-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('PROJECT', 'SUBSCRIPTION');

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'PROJECT',
ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastPaidAt" TIMESTAMP(3),
ADD COLUMN     "paidUntil" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
