-- CreateEnum
CREATE TYPE "ContactMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "areaId" TEXT,
    "organizationId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT NOT NULL,
    "direction" "ContactMessageDirection" NOT NULL,
    "subject" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "brevoMessageId" TEXT,
    "sentById" TEXT,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_deletedAt_lastName_firstName_idx" ON "Contact"("deletedAt", "lastName", "firstName");

-- CreateIndex
-- Contrainte d'idempotence de la réception : Brevo rejoue ses webhooks.
CREATE UNIQUE INDEX "ContactMessage_brevoMessageId_key" ON "ContactMessage"("brevoMessageId");

-- CreateIndex
CREATE INDEX "ContactMessage_contactId_createdAt_idx" ON "ContactMessage"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
