-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "headers" JSONB,
    "body" TEXT,
    "bodyMode" TEXT NOT NULL DEFAULT 'inherit',
    "expectation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ExecutionResult" ADD COLUMN "scenarioId" TEXT;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SavedRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionResult" ADD CONSTRAINT "ExecutionResult_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
