-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RequestToStructure" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequestToStructure_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RequestToStructure_B_index" ON "_RequestToStructure"("B");

-- AddForeignKey
ALTER TABLE "_RequestToStructure" ADD CONSTRAINT "_RequestToStructure_A_fkey" FOREIGN KEY ("A") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestToStructure" ADD CONSTRAINT "_RequestToStructure_B_fkey" FOREIGN KEY ("B") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
