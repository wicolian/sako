-- CreateTable
CREATE TABLE "task_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'DESIGN',
    "brandId" TEXT,
    "structuredBriefJson" JSONB,
    "referenceLinksJson" JSONB,
    "deliverablesJson" JSONB,
    "useAI" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_credit_history" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_credit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_drafts_workspaceId_idx" ON "task_drafts"("workspaceId");

-- CreateIndex
CREATE INDEX "day_credit_history_workspaceId_createdAt_idx" ON "day_credit_history"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "task_drafts" ADD CONSTRAINT "task_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
