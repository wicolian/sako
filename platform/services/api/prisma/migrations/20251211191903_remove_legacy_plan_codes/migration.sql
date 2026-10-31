/*
  Warnings:

  - The values [CORE_DESIGN,CORE_MOTION] on the enum `PlanCode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanCode_new" AS ENUM ('CORE', 'OPS', 'ENTERPRISE', 'COMPOSER_FREE', 'COMPOSER_PRO');
ALTER TABLE "plans" ALTER COLUMN "code" TYPE "PlanCode_new" USING ("code"::text::"PlanCode_new");
ALTER TABLE "subscriptions" ALTER COLUMN "planCode" TYPE "PlanCode_new" USING ("planCode"::text::"PlanCode_new");
ALTER TABLE "task_estimate_snapshots" ALTER COLUMN "planCode" TYPE "PlanCode_new" USING ("planCode"::text::"PlanCode_new");
ALTER TABLE "workspace_plan_overrides" ALTER COLUMN "basePlanCode" TYPE "PlanCode_new" USING ("basePlanCode"::text::"PlanCode_new");
ALTER TYPE "PlanCode" RENAME TO "PlanCode_old";
ALTER TYPE "PlanCode_new" RENAME TO "PlanCode";
DROP TYPE "PlanCode_old";
COMMIT;

-- DropIndex
DROP INDEX "idx_ai_credit_workspace_period";

-- DropIndex
DROP INDEX "idx_attachment_task";

-- DropIndex
DROP INDEX "idx_day_credit_workspace_period";

-- DropIndex
DROP INDEX "idx_comment_task_created";

-- DropIndex
DROP INDEX "idx_task_workspace_created";

-- DropIndex
DROP INDEX "idx_workspace_member_user";

-- CreateIndex
CREATE INDEX "ai_credits_workspaceId_periodEnd_idx" ON "ai_credits"("workspaceId", "periodEnd");

-- CreateIndex
CREATE INDEX "day_credits_workspaceId_periodEnd_idx" ON "day_credits"("workspaceId", "periodEnd");
