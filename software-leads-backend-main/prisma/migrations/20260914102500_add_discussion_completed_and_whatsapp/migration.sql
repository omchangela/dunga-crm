-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'DISCUSSION_COMPLETED';

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'DISCUSSION_COMPLETED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastDeadlineReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "last15dReminderSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "last7dReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsAppNotificationLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientName" TEXT,
    "message" TEXT NOT NULL,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppNotificationLog_referenceId_type_idx" ON "WhatsAppNotificationLog"("referenceId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppNotificationLog_type_sentAt_idx" ON "WhatsAppNotificationLog"("type", "sentAt");
