import {
  PrismaClient,
  PlanCode as PrismaPlanCode,
  SubscriptionStatus,
  TaskStatus,
  TaskCategory,
  TaskScope,
  WorkspaceRole,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { buildPlanDefinitions } from '../src/billing/plan.config';

const prisma = new PrismaClient();

type PlanPricing = {
  name: string;
  monthly: number;
  annual: number;
  taskScope: TaskScope;
  allowedCategories: TaskCategory[];
};

// Canonical pricing + scope for plans
const PLAN_PRICING: Record<PrismaPlanCode, PlanPricing> = {
  [PrismaPlanCode.CORE]: {
    name: 'Core',
    monthly: 250000,
    annual: 2700000,
    taskScope: TaskScope.FULL, // CORE now supports both Design + Motion
    allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
  },
  [PrismaPlanCode.OPS]: {
    name: 'Ops Base',
    monthly: 450000,
    annual: 4860000,
    taskScope: TaskScope.FULL,
    allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
  },
  [PrismaPlanCode.ENTERPRISE]: {
    name: 'Enterprise',
    monthly: 850000,
    annual: 9180000,
    taskScope: TaskScope.FULL,
    allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
  },
  [PrismaPlanCode.COMPOSER_FREE]: {
    name: 'Composer Free',
    monthly: 0,
    annual: 0,
    taskScope: TaskScope.DESIGN_ONLY,
    allowedCategories: [TaskCategory.DESIGN],
  },
  [PrismaPlanCode.COMPOSER_PRO]: {
    name: 'Composer Pro',
    monthly: 3000,
    annual: 36000,
    taskScope: TaskScope.DESIGN_ONLY,
    allowedCategories: [TaskCategory.DESIGN],
  },
};

function getVariantForPlan(planCode: PrismaPlanCode, planDefinitions: Record<string, any>) {
  // Find monthly or yearly variant for the plan code
  return Object.values(planDefinitions).find((variant) => variant.planCode === planCode) ?? null;
}

async function seedPlans() {
  console.log('A) Seeding plans...');
  const seeded: string[] = [];

  // Create a minimal ConfigService for seeding
  const configService = {
    get: (key: string, defaultValue?: string) => process.env[key] || defaultValue || '',
  } as any;

  const planDefinitions = buildPlanDefinitions(configService);

  for (const code of Object.values(PrismaPlanCode)) {
    // Ensure every PlanCode from Prisma enum is represented
    const variant = getVariantForPlan(code as PrismaPlanCode, planDefinitions);
    if (!variant) {
      console.warn(`  • Skipping ${code} - no plan variant found`);
      continue;
    }

    const pricing = PLAN_PRICING[code as PrismaPlanCode];
    if (!pricing) {
      console.warn(`  • Skipping ${code} - no pricing configuration found`);
      continue;
    }

    const payload = {
      name: pricing.name,
      activeTaskLimit: variant.activeTaskLimit,
      taskScope: pricing.taskScope,
      allowedCategories: pricing.allowedCategories,
      priceMonthly: pricing.monthly,
      priceAnnual: pricing.annual,
    };

    const plan = await prisma.plan.upsert({
      where: { code: code as PrismaPlanCode },
      update: payload,
      create: {
        code: code as PrismaPlanCode,
        ...payload,
      },
    });

    seeded.push(plan.code);
    console.log(`  ✓ Plan upserted: ${plan.code}`);
  }

  console.log(`  ✅ Plans ready: ${seeded.join(', ')}`);
}

async function seedDemoWorkspace() {
  console.log('\nB) Seeding demo workspace (optional sandbox data)...');

  const corePlan = await prisma.plan.findUnique({
    where: { code: PrismaPlanCode.CORE },
  });

  if (!corePlan) {
    console.warn('  • Skipping demo workspace seed because CORE plan was not found.');
    return;
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Workspace',
      timezone: 'UTC',
      planId: corePlan.id,
    },
  });
  console.log('  ✓ Workspace ready:', workspace.id);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@trysako.com' },
    update: {},
    create: {
      email: 'demo@trysako.com',
      name: 'Demo Client',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: demoUser.id,
      role: WorkspaceRole.OWNER,
    },
  });
  console.log('  ✓ Demo user linked to workspace');

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      planCode: PrismaPlanCode.CORE,
      status: SubscriptionStatus.ACTIVE,
      slaSeconds: 172800,
    },
  });
  console.log('  ✓ Subscription created');

  let brand = await prisma.brand.findFirst({
    where: {
      workspaceId: workspace.id,
      name: 'Voyage',
    },
  });

  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        workspaceId: workspace.id,
        name: 'Voyage',
        colorsJson: {
          primary: '#9ae83e',
          secondary: '#283711',
        },
        toneTags: ['professional', 'modern', 'clean'],
        guidelines: 'Voyage brand guidelines: Keep it clean, modern, and professional.',
      },
    });
    console.log('  ✓ Brand created');
  } else {
    console.log('  ⏭️  Brand already exists');
  }

  const existingTasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      title: {
        in: ['Homepage redesign', 'Pricing page clean-up', 'Launch graphics prep'],
      },
    },
  });

  if (existingTasks.length === 0) {
    await prisma.task.createMany({
      data: [
        {
          workspaceId: workspace.id,
          brandId: brand.id,
          title: 'Homepage redesign',
          description: 'Redesign the homepage to match the new brand guidelines. Focus on hero section and CTA.',
          category: TaskCategory.DESIGN,
          status: TaskStatus.IN_PROGRESS,
          inProgressAt: new Date(),
        },
        {
          workspaceId: workspace.id,
          brandId: brand.id,
          title: 'Pricing page clean-up',
          description: 'Clean up the pricing page layout and make it more user-friendly.',
          category: TaskCategory.DESIGN,
          status: TaskStatus.QUEUED,
        },
        {
          workspaceId: workspace.id,
          brandId: brand.id,
          title: 'Launch graphics prep',
          description: 'Prepare all graphics and assets for the product launch campaign.',
          category: TaskCategory.DESIGN,
          status: TaskStatus.QUEUED,
        },
      ],
    });
    console.log('  ✓ Tasks created');
  } else {
    console.log('  ⏭️  Tasks already exist, skipping');
  }

  console.log('  Demo workspace seeded. Use this as x-workspace-id header:', workspace.id);
}

async function main() {
  console.log('🌱 Starting seed...');
  await seedPlans();
  await seedDemoWorkspace();
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
