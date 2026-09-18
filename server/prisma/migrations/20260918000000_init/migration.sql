-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "body" TEXT,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "responseHeaders" JSONB NOT NULL DEFAULT '{}',
    "responseBody" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SavedRequest" ADD CONSTRAINT "SavedRequest_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionResult" ADD CONSTRAINT "ExecutionResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SavedRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
