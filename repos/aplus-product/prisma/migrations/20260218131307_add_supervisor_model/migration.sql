-- CreateTable
CREATE TABLE "Supervisor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OrganizationToSupervisor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToSupervisor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AreaToSupervisor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AreaToSupervisor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_userId_key" ON "Supervisor"("userId");

-- CreateIndex
CREATE INDEX "_OrganizationToSupervisor_B_index" ON "_OrganizationToSupervisor"("B");

-- CreateIndex
CREATE INDEX "_AreaToSupervisor_B_index" ON "_AreaToSupervisor"("B");

-- AddForeignKey
ALTER TABLE "Supervisor" ADD CONSTRAINT "Supervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationToSupervisor" ADD CONSTRAINT "_OrganizationToSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationToSupervisor" ADD CONSTRAINT "_OrganizationToSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaToSupervisor" ADD CONSTRAINT "_AreaToSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaToSupervisor" ADD CONSTRAINT "_AreaToSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
