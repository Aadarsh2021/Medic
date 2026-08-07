-- CreateTable
CREATE TABLE "FileMetadata" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileMetadata_storageKey_key" ON "FileMetadata"("storageKey");

-- CreateIndex
CREATE INDEX "FileMetadata_hospitalId_idx" ON "FileMetadata"("hospitalId");

-- CreateIndex
CREATE INDEX "FileMetadata_uploaderUserId_idx" ON "FileMetadata"("uploaderUserId");

-- CreateIndex
CREATE INDEX "FileMetadata_storageKey_idx" ON "FileMetadata"("storageKey");

-- AddForeignKey
ALTER TABLE "FileMetadata" ADD CONSTRAINT "FileMetadata_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileMetadata" ADD CONSTRAINT "FileMetadata_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
