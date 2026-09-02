-- AlterTable
ALTER TABLE "Developer" ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "DeveloperRefreshToken" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,

    CONSTRAINT "DeveloperRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperRefreshToken_developerId_idx" ON "DeveloperRefreshToken"("developerId");

-- AddForeignKey
ALTER TABLE "DeveloperRefreshToken" ADD CONSTRAINT "DeveloperRefreshToken_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
