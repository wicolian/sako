-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "isEscalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaCreditIssuedAt" TIMESTAMP(3),
ADD COLUMN     "slaWarningNotifiedAt" TIMESTAMP(3);
