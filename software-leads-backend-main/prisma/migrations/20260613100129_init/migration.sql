-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('WEB_DEVELOPMENT', 'APP_DEVELOPMENT', 'APP_WEB_DEVELOPMENT', 'DIGITAL_MARKETING', 'DESIGN_SERVICES', 'OTHERS');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('ADVERTISEMENT', 'CLIENT_REFERENCE', 'SALES_EXECUTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'CONVERTED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "state" TEXT,
    "city" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "followUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "reminderAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "state" TEXT,
    "city" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "webOverview" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appOverview" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminOverview" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payments" JSONB NOT NULL DEFAULT '[]',
    "timelines" JSONB NOT NULL DEFAULT '[]',
    "schedules" JSONB NOT NULL DEFAULT '[]',
    "contractNumber" TEXT,
    "deadline" TIMESTAMP(3),
    "developers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featureItems" JSONB NOT NULL DEFAULT '[]',
    "costHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_key" ON "Lead"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_applicationNumber_key" ON "Customer"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_leadId_key" ON "Customer"("leadId");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
