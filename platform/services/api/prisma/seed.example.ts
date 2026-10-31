import { PrismaClient, PlanCode, SubscriptionStatus, TaskCategory, TaskStatus, TaskScope } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Plans
  // V1 Plans: CORE, OPS, ENTERPRISE (all include Design + Motion)
  console.log('Creating plans...');
  
  const corePlan = await prisma.plan.upsert({
    where: { code: PlanCode.CORE },
    update: {},
    create: {
      code: PlanCode.CORE,
      name: 'Core',
      activeTaskLimit: 1,
      taskScope: TaskScope.FULL,
      allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
      priceMonthly: 250000, // $2,500.00
      priceAnnual: 2700000, // $27,000.00
    },
  });

  const opsPlan = await prisma.plan.upsert({
    where: { code: PlanCode.OPS },
    update: {},
    create: {
      code: PlanCode.OPS,
      name: 'Ops Base',
      activeTaskLimit: 2,
      taskScope: TaskScope.FULL,
      allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
      priceMonthly: 450000, // $4,500.00
      priceAnnual: 4860000, // $48,600.00
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { code: PlanCode.ENTERPRISE },
    update: {},
    create: {
      code: PlanCode.ENTERPRISE,
      name: 'Enterprise',
      activeTaskLimit: 3, // default, can be overridden per subscription
      taskScope: TaskScope.FULL,
      allowedCategories: [TaskCategory.DESIGN, TaskCategory.MOTION],
      priceMonthly: 850000, // $8,500.00
      priceAnnual: 9180000, // $91,800.00
    },
  });

  // 2. Create Demo Users
  console.log('Creating users...');
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      name: 'Demo Client',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sako.com' },
    update: {},
    create: {
      email: 'admin@sako.com',
      name: 'Sako Admin',
    },
  });

  // 3. Create Demo Workspace (CORE plan)
  console.log('Creating workspace...');
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      timezone: 'America/New_York',
      planId: corePlan.id,
      subscription: {
        create: {
          status: SubscriptionStatus.ACTIVE,
          planCode: PlanCode.CORE,
          billingPeriodStart: new Date(),
          billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      },
      members: {
        create: [
          {
            userId: clientUser.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });

  // 4. Create Brand
  console.log('Creating brand...');
  const brand = await prisma.brand.create({
    data: {
      workspaceId: workspace.id,
      name: 'Acme Brand',
      colorsJson: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
      },
      toneTags: ['professional', 'modern', 'trustworthy'],
      guidelines: 'Clean, modern design with blue as primary color. Focus on clarity and usability.',
    },
  });

  // 5. Create Sample Tasks
  console.log('Creating tasks...');
  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      title: 'Design hero section for landing page',
      description: 'Create a hero section with headline, subheading, CTA button, and hero image. Follow brand guidelines.',
      category: TaskCategory.DESIGN,
      status: TaskStatus.QUEUED,
      createdById: clientUser.id,
      slaSeconds: 172800, // 48h
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      title: 'Create pricing table component',
      description: 'Three-tier pricing table with hover effects and CTA buttons for each tier.',
      category: TaskCategory.DESIGN,
      status: TaskStatus.QUEUED,
      createdById: clientUser.id,
      slaSeconds: 172800,
    },
  });

  // 6. Create Credits
  console.log('Creating credits...');
  await prisma.dayCredit.create({
    data: {
      workspaceId: workspace.id,
      totalCredits: 30,
      usedCredits: 0,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
    },
  });

  await prisma.aICredit.create({
    data: {
      workspaceId: workspace.id,
      totalCredits: 999999, // Unlimited for Studio plans
      usedCredits: 0,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  console.log('✅ Seeding complete!');
  console.log('\n📋 Demo Credentials:');
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Client User ID: ${clientUser.id}`);
  console.log(`Admin User ID: ${adminUser.id}`);
  console.log(`\n🧪 Test with:`);
  console.log(`curl -H "x-workspace-id: ${workspace.id}" http://localhost:3001/api/v1/workspace/me`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
