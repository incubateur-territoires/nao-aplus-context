-- CreateTable
CREATE TABLE "SiteBanner" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);
