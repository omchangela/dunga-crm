/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Developer` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `Developer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Developer" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");
