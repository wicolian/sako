/*
 * Sako Test User Cleanup Script
 *
 * Usage (from repo root):
 *   npm run delete-test-user -- <email_or_user_id>
 *
 * Or manually:
 *   cd services/api && npx ts-node --transpile-only ../../scripts/delete-test-user.ts <email_or_user_id>
 *
 * This script:
 *   - Cancels Stripe subscriptions immediately
 *   - Deletes all workspaces owned by the user (cascades to tasks, brands, etc.)
 *   - Removes user from non-owned workspaces
 *   - Deletes the user record from the database
 *   - DOES NOT delete the Clerk account (so the email can be reused for testing)
 *
 * Safety:
 *   - Requires ENABLE_DEV_ADMIN=true to run
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, WorkspaceRole } from '@prisma/client';
import Stripe from 'stripe';

// Load .env file (we run from services/api directory via npm script)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1).replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
    console.log(`📄 Loaded env from: ${envPath}`);
  }
}

loadEnv();

const ENABLE_DEV_ADMIN = process.env.ENABLE_DEV_ADMIN;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// Validate environment
if (ENABLE_DEV_ADMIN !== 'true') {
  console.error('ERROR: ENABLE_DEV_ADMIN must be set to "true" to run this script.');
  console.error('This is a safety measure to prevent accidental production use.');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is required.');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY is required.');
  process.exit(1);
}

const emailOrUserId = process.argv[2];
if (!emailOrUserId) {
  console.error('Usage: npx ts-node scripts/delete-test-user.ts <email_or_user_id>');
  console.error('Example: npx ts-node scripts/delete-test-user.ts test@example.com');
  process.exit(1);
}

const prisma = new PrismaClient();
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

interface CleanupSummary {
  userId: string;
  email: string;
  stripeSubscriptionsCancelled: string[];
  workspacesDeleted: string[];
  membershipsRemoved: number;
  userDeleted: boolean;
  errors: string[];
}

async function findUser(emailOrId: string) {
  // Try to find by email first, then by ID
  let user = await prisma.user.findUnique({
    where: { email: emailOrId },
    include: {
      memberships: {
        include: {
          workspace: {
            include: {
              subscription: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: emailOrId },
      include: {
        memberships: {
          include: {
            workspace: {
              include: {
                subscription: true,
              },
            },
          },
        },
      },
    });
  }

  return user;
}

async function main() {
  console.log(`\n🔍 Looking up user: ${emailOrUserId}`);

  const user = await findUser(emailOrUserId);

  if (!user) {
    console.error(`\n❌ User not found: ${emailOrUserId}`);
    process.exit(1);
  }

  // Safety check: don't delete super admins
  if (user.isSuperAdmin) {
    console.error(`\n❌ Cannot delete super admin: ${user.email}`);
    process.exit(1);
  }

  console.log(`\n📋 Found user:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name || '(not set)'}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Workspaces: ${user.memberships.length}`);

  const summary: CleanupSummary = {
    userId: user.id,
    email: user.email,
    stripeSubscriptionsCancelled: [],
    workspacesDeleted: [],
    membershipsRemoved: 0,
    userDeleted: false,
    errors: [],
  };

  // Find workspaces where user is OWNER
  const ownedWorkspaces = user.memberships.filter(
    (m) => m.role === WorkspaceRole.OWNER,
  );
  const nonOwnedMemberships = user.memberships.filter(
    (m) => m.role !== WorkspaceRole.OWNER,
  );

  console.log(`\n🏢 Owned workspaces to delete: ${ownedWorkspaces.length}`);
  console.log(`👥 Non-owned memberships to remove: ${nonOwnedMemberships.length}`);

  // Cancel Stripe subscriptions and delete owned workspaces
  for (const membership of ownedWorkspaces) {
    const workspace = membership.workspace;
    const subscription = workspace.subscription;

    console.log(`\n📦 Processing workspace: ${workspace.name} (${workspace.id})`);

    // Cancel Stripe subscription if exists
    if (subscription?.stripeSubscriptionId) {
      try {
        console.log(`   💳 Cancelling Stripe subscription: ${subscription.stripeSubscriptionId}`);
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
          prorate: true,
        });
        summary.stripeSubscriptionsCancelled.push(subscription.stripeSubscriptionId);
        console.log(`   ✅ Stripe subscription cancelled`);
      } catch (err: any) {
        // If subscription is already cancelled or doesn't exist, continue
        if (err.code === 'resource_missing') {
          console.log(`   ⚠️  Stripe subscription not found (already cancelled?)`);
        } else {
          const errorMsg = `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}: ${err.message}`;
          summary.errors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`);
        }
      }
    } else {
      console.log(`   ℹ️  No Stripe subscription to cancel`);
    }

    // Delete workspace (cascades to subscription, tasks, brands, members, etc.)
    try {
      console.log(`   🗑️  Deleting workspace...`);
      await prisma.workspace.delete({
        where: { id: workspace.id },
      });
      summary.workspacesDeleted.push(workspace.id);
      console.log(`   ✅ Workspace deleted`);
    } catch (err: any) {
      const errorMsg = `Failed to delete workspace ${workspace.id}: ${err.message}`;
      summary.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }

  // Remove non-owned memberships
  for (const membership of nonOwnedMemberships) {
    try {
      console.log(`\n👋 Removing membership from workspace: ${membership.workspace.name}`);
      await prisma.workspaceMember.delete({
        where: { id: membership.id },
      });
      summary.membershipsRemoved++;
      console.log(`   ✅ Membership removed`);
    } catch (err: any) {
      const errorMsg = `Failed to remove membership ${membership.id}: ${err.message}`;
      summary.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }

  // Delete the user record
  try {
    console.log(`\n🧹 Deleting user record from database...`);
    await prisma.user.delete({
      where: { id: user.id },
    });
    summary.userDeleted = true;
    console.log(`   ✅ User deleted from database`);
  } catch (err: any) {
    const errorMsg = `Failed to delete user ${user.id}: ${err.message}`;
    summary.errors.push(errorMsg);
    console.error(`   ❌ ${errorMsg}`);
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`User ID: ${summary.userId}`);
  console.log(`Email: ${summary.email}`);
  console.log(`Stripe subscriptions cancelled: ${summary.stripeSubscriptionsCancelled.length}`);
  console.log(`Workspaces deleted: ${summary.workspacesDeleted.length}`);
  console.log(`Memberships removed: ${summary.membershipsRemoved}`);
  console.log(`User deleted: ${summary.userDeleted ? 'Yes' : 'No'}`);
  console.log(`Errors: ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    summary.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  }

  if (summary.userDeleted) {
    console.log(`\n✅ User ${user.email} has been cleaned up.`);
    console.log(`   Clerk account preserved - email can be reused for testing.`);
  } else {
    console.log(`\n⚠️  Cleanup completed with errors. User may not be fully deleted.`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Script failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});












