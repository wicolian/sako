import { StripeEventsService } from '../src/stripe/stripe-events.service';
import Stripe from 'stripe';
import { SubscriptionStatus, PlanCode } from '@prisma/client';

describe('StripeEventsService subscription sync', () => {
  let subscriptionRecord: any;

  const createdDayCredits: any[] = [];
  const createdAiCredits: any[] = [];

  // Mock transaction context
  const txMock: any = {
    subscription: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    dayCredit: {
      create: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    aICredit: {
      create: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    dayCreditHistory: {
      create: jest.fn(),
    },
  };

  const prismaMock: any = {
    subscription: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    dayCredit: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    aICredit: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const analyticsMock: any = {
    trackWorkspaceEvent: jest.fn(),
    trackPaymentSucceeded: jest.fn(),
    trackPaymentFailed: jest.fn(),
  };

  // Mock config service to return Stripe price IDs for CORE_MONTHLY
  const configServiceMock: any = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'STRIPE_PRICE_ID_CORE_MONTHLY': 'price_core_monthly',
        'STRIPE_PRICE_ID_CORE_YEARLY': 'price_core_yearly',
      };
      return config[key] ?? null;
    }),
  };

  const service = new StripeEventsService(prismaMock, analyticsMock, configServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
    createdDayCredits.length = 0;
    createdAiCredits.length = 0;
    
    subscriptionRecord = {
      id: 'sub-db-1',
      workspaceId: 'ws_1',
      stripeSubscriptionId: 'sub_123',
      status: SubscriptionStatus.PAST_DUE,
      planCode: PlanCode.CORE,
      billingPeriodStart: null as Date | null,
      billingPeriodEnd: null as Date | null,
    };

    prismaMock.subscription.findFirst.mockResolvedValue({ ...subscriptionRecord });
    prismaMock.subscription.findUnique.mockResolvedValue(subscriptionRecord);
    
    // Setup transaction mock
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<void>) => {
      await callback(txMock);
    });

    txMock.subscription.update.mockImplementation(({ data }: any) => {
      Object.assign(subscriptionRecord, data);
      return Promise.resolve(subscriptionRecord);
    });
    txMock.subscription.findUnique.mockResolvedValue(subscriptionRecord);
    
    txMock.dayCredit.create.mockImplementation(({ data }: any) => {
      createdDayCredits.push(data);
      return Promise.resolve(data);
    });
    txMock.aICredit.create.mockImplementation(({ data }: any) => {
      createdAiCredits.push(data);
      return Promise.resolve(data);
    });
    txMock.dayCredit.findFirst.mockImplementation(() =>
      Promise.resolve(createdDayCredits[createdDayCredits.length - 1] || null),
    );
    txMock.aICredit.findFirst.mockImplementation(() =>
      Promise.resolve(createdAiCredits[createdAiCredits.length - 1] || null),
    );
    txMock.dayCredit.upsert.mockImplementation(({ create }: any) => {
      createdDayCredits.push(create);
      return Promise.resolve(create);
    });
    txMock.aICredit.upsert.mockImplementation(({ create }: any) => {
      createdAiCredits.push(create);
      return Promise.resolve(create);
    });
    
    prismaMock.plan.findUnique.mockResolvedValue({ code: 'CORE', activeTaskLimit: 1 });
  });

  it('marks subscription active and allocates credits on invoice paid', async () => {
    const periodStart = Math.floor(Date.now() / 1000);
    const periodEnd = periodStart + 30 * 24 * 60 * 60;

    const invoice = {
      id: 'in_123',
      customer: 'cus_123',
      amount_paid: 250000,
      period_start: periodStart,
      period_end: periodEnd,
      subscription: 'sub_123',
      lines: {
        data: [{
          price: { id: 'price_core_monthly' },
          period: { start: periodStart, end: periodEnd },
        }],
      },
    } as unknown as Stripe.Invoice;

    const event = {
      data: { object: invoice },
    } as Stripe.Event;

    await service.handleInvoicePaid(event);

    expect(subscriptionRecord.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscriptionRecord.billingPeriodStart?.toISOString()).toBe(
      new Date(periodStart * 1000).toISOString(),
    );
    expect(subscriptionRecord.billingPeriodEnd?.toISOString()).toBe(
      new Date(periodEnd * 1000).toISOString(),
    );

    // Credits are allocated based on plan config (default CORE = 30 day credits, unlimited AI)
    expect(createdDayCredits).toHaveLength(1);
    expect(createdDayCredits[0].totalCredits).toBe(30);
    // CORE plan has unlimited AI credits (-1 means unlimited)
    expect(createdAiCredits).toHaveLength(1);
  });
});
