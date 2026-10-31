-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "inReviewAt" TIMESTAMP(3),
ADD COLUMN     "totalClientWaitSeconds" INTEGER NOT NULL DEFAULT 0;
