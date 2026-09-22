-- CreateTable
CREATE TABLE "PendingSupervisor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "PendingSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OrganizationToPendingSupervisor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToPendingSupervisor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AreaToPendingSupervisor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AreaToPendingSupervisor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSupervisor_email_key" ON "PendingSupervisor"("email");

-- CreateIndex
CREATE INDEX "_OrganizationToPendingSupervisor_B_index" ON "_OrganizationToPendingSupervisor"("B");

-- CreateIndex
CREATE INDEX "_AreaToPendingSupervisor_B_index" ON "_AreaToPendingSupervisor"("B");

-- AddForeignKey
ALTER TABLE "_OrganizationToPendingSupervisor" ADD CONSTRAINT "_OrganizationToPendingSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationToPendingSupervisor" ADD CONSTRAINT "_OrganizationToPendingSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES "PendingSupervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaToPendingSupervisor" ADD CONSTRAINT "_AreaToPendingSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaToPendingSupervisor" ADD CONSTRAINT "_AreaToPendingSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES "PendingSupervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
