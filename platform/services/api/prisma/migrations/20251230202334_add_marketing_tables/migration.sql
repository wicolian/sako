-- CreateEnum
CREATE TYPE "MarketingEmailStep" AS ENUM ('D0', 'D1', 'D3', 'D5', 'D10');

-- CreateEnum
CREATE TYPE "MarketingEmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED', 'DRY_RUN');

-- CreateEnum
CREATE TYPE "MarketingOfferKind" AS ENUM ('COUPON', 'PAYMENT_LINK');

-- CreateTable
CREATE TABLE "marketing_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "clerkUserId" TEXT,
    "source" TEXT NOT NULL,
    "signupDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedAt" TIMESTAMP(3),
    "suppressMarketing" BOOLEAN NOT NULL DEFAULT false,
    "suppressedAt" TIMESTAMP(3),
    "suppressedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_email_sends" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "step" "MarketingEmailStep" NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MarketingEmailStatus" NOT NULL,
    "error" VARCHAR(500),

    CONSTRAINT "marketing_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_offers" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" "MarketingOfferKind" NOT NULL,
    "stripeCouponId" TEXT,
    "stripePromotionCodeId" TEXT,
    "code" TEXT,
    "stripePaymentLinkId" TEXT,
    "planCode" TEXT,
    "percentOff" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_leads_email_key" ON "marketing_leads"("email");

-- CreateIndex
CREATE INDEX "marketing_leads_email_idx" ON "marketing_leads"("email");

-- CreateIndex
CREATE INDEX "marketing_leads_converted_unsubscribed_suppressMarketing_idx" ON "marketing_leads"("converted", "unsubscribed", "suppressMarketing");

-- CreateIndex
CREATE INDEX "marketing_leads_signupDate_idx" ON "marketing_leads"("signupDate");

-- CreateIndex
CREATE INDEX "marketing_email_sends_leadId_idx" ON "marketing_email_sends"("leadId");

-- CreateIndex
CREATE INDEX "marketing_email_sends_sentAt_idx" ON "marketing_email_sends"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_email_sends_leadId_step_key" ON "marketing_email_sends"("leadId", "step");

-- CreateIndex
CREATE INDEX "marketing_offers_leadId_idx" ON "marketing_offers"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_offers_leadId_kind_planCode_key" ON "marketing_offers"("leadId", "kind", "planCode");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_email_sends" ADD CONSTRAINT "marketing_email_sends_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "marketing_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_offers" ADD CONSTRAINT "marketing_offers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "marketing_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
