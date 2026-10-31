/*
  Warnings:

  - You are about to drop the column `composerRunId` on the `ai_drafts` table. All the data in the column will be lost.
  - You are about to drop the column `composerDraftId` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the `ai_generation_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `composer_runs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `published_pages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_drafts" DROP CONSTRAINT "ai_drafts_composerRunId_fkey";

-- DropForeignKey
ALTER TABLE "ai_generation_logs" DROP CONSTRAINT "ai_generation_logs_brandId_fkey";

-- DropForeignKey
ALTER TABLE "ai_generation_logs" DROP CONSTRAINT "ai_generation_logs_composerRunId_fkey";

-- DropForeignKey
ALTER TABLE "ai_generation_logs" DROP CONSTRAINT "ai_generation_logs_taskId_fkey";

-- DropForeignKey
ALTER TABLE "ai_generation_logs" DROP CONSTRAINT "ai_generation_logs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "composer_runs" DROP CONSTRAINT "composer_runs_brandId_fkey";

-- DropForeignKey
ALTER TABLE "composer_runs" DROP CONSTRAINT "composer_runs_taskId_fkey";

-- DropForeignKey
ALTER TABLE "composer_runs" DROP CONSTRAINT "composer_runs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "published_pages" DROP CONSTRAINT "published_pages_draftId_fkey";

-- DropForeignKey
ALTER TABLE "published_pages" DROP CONSTRAINT "published_pages_workspaceId_fkey";

-- DropIndex
DROP INDEX "ai_drafts_composerRunId_idx";

-- AlterTable
ALTER TABLE "ai_drafts" DROP COLUMN "composerRunId";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "composerDraftId";

-- DropTable
DROP TABLE "ai_generation_logs";

-- DropTable
DROP TABLE "composer_runs";

-- DropTable
DROP TABLE "published_pages";

-- DropEnum
DROP TYPE "ComposerRunStatus";
