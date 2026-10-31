-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('CORE', 'CORE_DESIGN', 'CORE_MOTION', 'OPS', 'ENTERPRISE', 'COMPOSER_FREE', 'COMPOSER_PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'CANCEL_AT_PERIOD_END');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('DESIGN', 'MOTION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PENDING_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'SUBMITTER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('COMMENT', 'REVISION_REQUEST', 'ADMIN_DECISION');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('SLACK', 'LINEAR', 'JIRA', 'ASANA');

-- CreateEnum
CREATE TYPE "TaskScope" AS ENUM ('DESIGN_ONLY', 'MOTION_ONLY', 'FULL');

-- CreateEnum
CREATE TYPE "AiDraftType" AS ENUM ('LANDING_PAGE', 'AD_CREATIVE', 'BANNER');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FigmaExportStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'READY', 'FAILED', 'FAILED_RATE_LIMIT');

-- CreateEnum
CREATE TYPE "ComposerSource" AS ENUM ('TASK', 'COMPOSER_STANDALONE');

-- CreateEnum
CREATE TYPE "ComposerRunStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SlackConnectStatus" AS ENUM ('NOT_CONNECTED', 'CONNECT_PENDING', 'CONNECTED');

-- CreateEnum
CREATE TYPE "ReviewAssetType" AS ENUM ('IMAGE', 'PDF', 'VIDEO', 'FIGMA', 'LOTTIE', 'RIVE', 'EMBED');

-- CreateEnum
CREATE TYPE "ReviewRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ReviewAnnotationKind" AS ENUM ('IMAGE_PIN', 'PDF_PIN', 'VIDEO_TIME', 'LOTTIE_TIME', 'RIVE_TIME', 'EMBED_REF');

-- CreateEnum
CREATE TYPE "AnnotationSource" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planId" TEXT,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "activeTaskLimit" INTEGER NOT NULL,
    "allowedCategories" "TaskCategory"[],
    "taskScope" "TaskScope" NOT NULL DEFAULT 'FULL',
    "priceMonthly" INTEGER NOT NULL,
    "priceAnnual" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "stripeSubscriptionId" TEXT,
    "planCode" "PlanCode" NOT NULL,
    "mode" TEXT,
    "activeTaskLimit" INTEGER,
    "slaSeconds" INTEGER,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "lastDayCreditBurnAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "workspaceId" TEXT,
    "planKey" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "checkout_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "guidelineUrl" TEXT,
    "colorsJson" JSONB,
    "typographyJson" JSONB,
    "brandProfileJson" JSONB,
    "toneTags" TEXT[],
    "voiceGuidelines" TEXT,
    "guidelines" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "createdById" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inProgressAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "slaSeconds" INTEGER NOT NULL DEFAULT 172800,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "externalSource" "IntegrationProvider",
    "externalId" TEXT,
    "slackChannelId" TEXT,
    "slackThreadTs" TEXT,
    "structuredBriefJson" JSONB,
    "referenceLinksJson" JSONB,
    "deliverablesJson" JSONB,
    "estimatedEffortHours" INTEGER,
    "displaySlaHours" INTEGER,
    "fits48hWindow" BOOLEAN,
    "flagForAdminReview" BOOLEAN,
    "aiEligible" BOOLEAN NOT NULL DEFAULT true,
    "aiIneligibleReason" TEXT,
    "useAI" BOOLEAN NOT NULL DEFAULT false,
    "aiDraftRequested" BOOLEAN NOT NULL DEFAULT false,
    "aiDraftStatus" "AiDraftStatus" NOT NULL DEFAULT 'NONE',
    "aiDraftSelectedId" TEXT,
    "source" "ComposerSource" NOT NULL DEFAULT 'TASK',
    "composerDraftId" TEXT,
    "composerExportUrl" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "kind" "CommentKind" NOT NULL DEFAULT 'COMMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_revisions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "revisionIndex" INTEGER NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_credits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "totalCredits" INTEGER NOT NULL,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "totalCredits" INTEGER NOT NULL,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_integrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_integration_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_integration_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackTeamName" TEXT,
    "slackEnterpriseId" TEXT,
    "slackBotUserId" TEXT,
    "botAccessToken" TEXT NOT NULL,
    "defaultChannelId" TEXT,
    "defaultChannelName" TEXT,
    "connectStatus" "SlackConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "installedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_estimate_snapshots" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "tagsJson" JSONB,
    "structuredBriefJson" JSONB,
    "brandId" TEXT,
    "brandName" TEXT,
    "planCode" "PlanCode" NOT NULL,
    "subscriptionMode" TEXT,
    "activeTaskSlots" INTEGER NOT NULL,
    "standardSlaHours" INTEGER NOT NULL,
    "estimatedEffortHoursRaw" INTEGER NOT NULL,
    "displaySlaHoursRaw" INTEGER NOT NULL,
    "complexity" TEXT NOT NULL,
    "complexityScore" INTEGER NOT NULL,
    "isAiSupported" BOOLEAN NOT NULL,
    "fits48hWindow" BOOLEAN NOT NULL,
    "flagForAdminReview" BOOLEAN NOT NULL,
    "flagReason" TEXT,
    "recommendedSplitCount" INTEGER NOT NULL,
    "suggestedSubtasksJson" JSONB,
    "missingInfoJson" JSONB,
    "aiHelpRecommended" BOOLEAN NOT NULL,
    "aiHelpReason" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_estimate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_lifecycle_events" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "actorRole" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_plan_overrides" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "basePlanCode" "PlanCode" NOT NULL,
    "customActiveTaskLimit" INTEGER,
    "customTatSeconds" INTEGER,
    "customStripePriceId" TEXT,
    "customMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_plan_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assets" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "ReviewAssetType" NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_asset_revisions" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "fileUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_asset_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_annotations" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetRevisionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "ReviewAnnotationKind" NOT NULL,
    "text" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "parentId" TEXT,
    "source" "AnnotationSource" NOT NULL DEFAULT 'USER',

    CONSTRAINT "review_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "brandId" TEXT NOT NULL,
    "composerRunId" TEXT,
    "type" "AiDraftType" NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'PENDING',
    "previewImageUrl" TEXT,
    "html" TEXT,
    "designJson" JSONB,
    "reasoning" JSONB,
    "variantLabel" TEXT,
    "primaryHeadline" TEXT,
    "mainCta" TEXT,
    "provider" TEXT,
    "modelUsed" TEXT,
    "exportStatus" "FigmaExportStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "exportMeta" JSONB,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "selectedAction" TEXT,
    "rating" INTEGER,
    "feedbackNote" TEXT,
    "embeddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composer_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "brandId" TEXT NOT NULL,
    "source" "ComposerSource" NOT NULL,
    "assetType" "AiDraftType" NOT NULL,
    "status" "ComposerRunStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "briefJson" JSONB,
    "variantCount" INTEGER NOT NULL DEFAULT 2,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composer_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "composerRunId" TEXT,
    "taskId" TEXT,
    "brandId" TEXT NOT NULL,
    "brandSnapshotJson" JSONB NOT NULL,
    "briefJson" JSONB NOT NULL,
    "contextJson" JSONB NOT NULL,
    "reasoning" JSONB,
    "planJson" JSONB,
    "providerBreakdown" JSONB,
    "totalTokensIn" INTEGER,
    "totalTokensOut" INTEGER,
    "totalCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_pages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "draftId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_name_idx" ON "workspaces"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_workspaceId_key" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_attempts_stripeSessionId_key" ON "checkout_attempts"("stripeSessionId");

-- CreateIndex
CREATE INDEX "checkout_attempts_userId_idx" ON "checkout_attempts"("userId");

-- CreateIndex
CREATE INDEX "checkout_attempts_userId_status_idx" ON "checkout_attempts"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_status_idx" ON "tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_createdAt_idx" ON "tasks"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_title_idx" ON "tasks"("title");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_integrations_workspaceId_provider_key" ON "workspace_integrations"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "task_integration_links_taskId_provider_key" ON "task_integration_links"("taskId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_slackTeamId_key" ON "slack_integrations"("slackTeamId");

-- CreateIndex
CREATE INDEX "task_lifecycle_events_taskId_createdAt_idx" ON "task_lifecycle_events"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_plan_overrides_workspaceId_key" ON "workspace_plan_overrides"("workspaceId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "review_assets_taskId_idx" ON "review_assets"("taskId");

-- CreateIndex
CREATE INDEX "review_asset_revisions_assetId_isCurrent_idx" ON "review_asset_revisions"("assetId", "isCurrent");

-- CreateIndex
CREATE INDEX "review_annotations_taskId_resolved_idx" ON "review_annotations"("taskId", "resolved");

-- CreateIndex
CREATE INDEX "review_annotations_assetRevisionId_idx" ON "review_annotations"("assetRevisionId");

-- CreateIndex
CREATE INDEX "ai_drafts_workspaceId_idx" ON "ai_drafts"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_drafts_taskId_idx" ON "ai_drafts"("taskId");

-- CreateIndex
CREATE INDEX "ai_drafts_brandId_idx" ON "ai_drafts"("brandId");

-- CreateIndex
CREATE INDEX "ai_drafts_composerRunId_idx" ON "ai_drafts"("composerRunId");

-- CreateIndex
CREATE INDEX "composer_runs_workspaceId_idx" ON "composer_runs"("workspaceId");

-- CreateIndex
CREATE INDEX "composer_runs_taskId_idx" ON "composer_runs"("taskId");

-- CreateIndex
CREATE INDEX "composer_runs_status_idx" ON "composer_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generation_logs_composerRunId_key" ON "ai_generation_logs"("composerRunId");

-- CreateIndex
CREATE INDEX "ai_generation_logs_workspaceId_idx" ON "ai_generation_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_generation_logs_taskId_idx" ON "ai_generation_logs"("taskId");

-- CreateIndex
CREATE INDEX "ai_generation_logs_brandId_idx" ON "ai_generation_logs"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "published_pages_slug_key" ON "published_pages"("slug");

-- CreateIndex
CREATE INDEX "published_pages_workspaceId_idx" ON "published_pages"("workspaceId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_credits" ADD CONSTRAINT "day_credits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credits" ADD CONSTRAINT "ai_credits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_integration_links" ADD CONSTRAINT "task_integration_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_estimate_snapshots" ADD CONSTRAINT "task_estimate_snapshots_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_estimate_snapshots" ADD CONSTRAINT "task_estimate_snapshots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_lifecycle_events" ADD CONSTRAINT "task_lifecycle_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_plan_overrides" ADD CONSTRAINT "workspace_plan_overrides_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assets" ADD CONSTRAINT "review_assets_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_asset_revisions" ADD CONSTRAINT "review_asset_revisions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "review_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_annotations" ADD CONSTRAINT "review_annotations_assetRevisionId_fkey" FOREIGN KEY ("assetRevisionId") REFERENCES "review_asset_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_annotations" ADD CONSTRAINT "review_annotations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "review_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_composerRunId_fkey" FOREIGN KEY ("composerRunId") REFERENCES "composer_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composer_runs" ADD CONSTRAINT "composer_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composer_runs" ADD CONSTRAINT "composer_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composer_runs" ADD CONSTRAINT "composer_runs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_composerRunId_fkey" FOREIGN KEY ("composerRunId") REFERENCES "composer_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_pages" ADD CONSTRAINT "published_pages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_pages" ADD CONSTRAINT "published_pages_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ai_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
