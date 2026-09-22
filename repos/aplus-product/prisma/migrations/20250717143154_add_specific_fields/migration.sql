-- CreateTable
CREATE TABLE "SpecificField" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,

    CONSTRAINT "SpecificField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SpecificFieldToStructure" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SpecificFieldToStructure_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SpecificFieldToStructure_B_index" ON "_SpecificFieldToStructure"("B");

-- AddForeignKey
ALTER TABLE "_SpecificFieldToStructure" ADD CONSTRAINT "_SpecificFieldToStructure_A_fkey" FOREIGN KEY ("A") REFERENCES "SpecificField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SpecificFieldToStructure" ADD CONSTRAINT "_SpecificFieldToStructure_B_fkey" FOREIGN KEY ("B") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
