-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "parentReminderId" TEXT;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_parentReminderId_fkey" FOREIGN KEY ("parentReminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
