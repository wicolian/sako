-- Performance Indexes Migration
-- Add indexes for common query patterns
-- Note: Removed CONCURRENTLY as Prisma migrations run in transactions

-- Task queries by workspace and status (most common query pattern)
CREATE INDEX IF NOT EXISTS "idx_task_workspace_status" ON "tasks"("workspaceId", "status");

-- Task queries by workspace and createdAt (for sorting/pagination)
CREATE INDEX IF NOT EXISTS "idx_task_workspace_created" ON "tasks"("workspaceId", "createdAt" DESC);

-- Task queries by brand (for brand detail pages)
CREATE INDEX IF NOT EXISTS "idx_task_brand" ON "tasks"("brandId") WHERE "brandId" IS NOT NULL;

-- Subscription lookup by Stripe ID (webhook processing)
CREATE INDEX IF NOT EXISTS "idx_subscription_stripe_id" ON "subscriptions"("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL;

-- Credits by workspace and period (credit balance queries)
CREATE INDEX IF NOT EXISTS "idx_day_credit_workspace_period" ON "day_credits"("workspaceId", "periodEnd" DESC);
CREATE INDEX IF NOT EXISTS "idx_ai_credit_workspace_period" ON "ai_credits"("workspaceId", "periodEnd" DESC);

-- Workspace member lookup (auth/permission checks)
CREATE INDEX IF NOT EXISTS "idx_workspace_member_user" ON "workspace_members"("userId");

-- User lookup by Clerk ID (auth flow)
CREATE INDEX IF NOT EXISTS "idx_user_clerk_id" ON "users"("clerkUserId") WHERE "clerkUserId" IS NOT NULL;

-- Attachment lookup by task
CREATE INDEX IF NOT EXISTS "idx_attachment_task" ON "attachments"("taskId");

-- Comment lookup by task and createdAt (for comment threads)
CREATE INDEX IF NOT EXISTS "idx_comment_task_created" ON "task_comments"("taskId", "createdAt" DESC);
