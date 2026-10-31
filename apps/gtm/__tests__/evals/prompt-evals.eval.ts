/**
 * Prompt Quality Evaluation Tests (Jan 2026)
 * 
 * Comprehensive eval harness for AI prompt quality with:
 * - Golden test cases for regression detection
 * - Consistency checks across runs
 * - Quality metrics (compliance, specificity, etc.)
 * 
 * Run with: bun run test:evals
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  generateLandingPageContent, 
  quickClaimCheck,
  generateMarketingAngles,
  generateEmailSequence,
  batchValidateClaims,
} from '@/lib/ai/ai-sdk-client';

const describeIfOpenRouter = process.env.OPENROUTER_API_KEY ? describe : describe.skip

// ============================================================================
// Golden Test Cases
// ============================================================================

const GOLDEN_CASES = {
  landingPage: [
    {
      name: 'B2B SaaS Demo Signup',
      input: { 
        audience: 'B2B SaaS founders scaling from $1M to $10M ARR', 
        goal: 'Demo signups', 
        offer: '14-day free trial with onboarding call' 
      },
      expectations: {
        headlineMinLength: 10,
        headlineMaxLength: 100,
        headlineNotContains: ['guaranteed', 'best', '#1', 'only', 'revolutionary'],
        benefitsMinCount: 3,
        benefitsMaxCount: 5,
        hasCTA: true,
      },
    },
    {
      name: 'Enterprise Security Lead Gen',
      input: { 
        audience: 'Enterprise CISOs and security directors', 
        goal: 'Whitepaper downloads', 
        offer: 'State of Cloud Security 2026 Report' 
      },
      expectations: {
        headlineMinLength: 10,
        headlineMaxLength: 100,
        headlineNotContains: ['hack-proof', '100% secure', 'unbreakable'],
        benefitsMinCount: 3,
        hasCTA: true,
      },
    },
  ],
  
  claimValidation: [
    // High-risk claims
    { input: 'The best solution on the market', expected: { riskLevel: 'high' } },
    { input: 'Guaranteed to increase revenue by 50%', expected: { riskLevel: 'high', requiresEvidence: true } },
    { input: 'The only platform that does X', expected: { riskLevel: 'high' } },
    { input: '#1 rated by customers', expected: { riskLevel: 'high', requiresEvidence: true } },
    { input: 'Cures all your marketing problems', expected: { riskLevel: 'high' } },
    
    // Medium-risk claims
    { input: 'Leading solution for enterprise teams', expected: { riskLevel: 'medium' } },
    { input: 'Most teams see results in 30 days', expected: { riskLevel: 'medium', requiresEvidence: true } },
    
    // Low-risk claims
    { input: 'Helps teams collaborate more effectively', expected: { riskLevel: 'low' } },
    { input: 'Designed for growing SaaS companies', expected: { riskLevel: 'low' } },
    { input: 'Integrates with popular tools like Slack and Salesforce', expected: { riskLevel: 'low' } },
  ],
  
  marketingAngles: [
    {
      name: 'Compliance Software',
      input: {
        name: 'ComplianceAI Launch',
        audience: 'Compliance officers at mid-market companies',
        goal: 'Demo requests',
        industry: 'RegTech',
      },
      expectations: {
        minAngles: 3,
        maxAngles: 5,
        hasUniqueHooks: true,
      },
    },
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

function containsAny(text: string, terms: string[]): boolean {
  const lowerText = text.toLowerCase();
  return terms.some(term => lowerText.includes(term.toLowerCase()));
}

// ============================================================================
// Landing Page Generation Tests
// ============================================================================

describeIfOpenRouter('Landing Page Generation Evals', () => {
  describe.each(GOLDEN_CASES.landingPage)('$name', (testCase) => {
    let result: Awaited<ReturnType<typeof generateLandingPageContent>>;
    
    beforeAll(async () => {
      const prompt = `Create landing page for ${testCase.input.audience}`;
      const context = JSON.stringify(testCase.input);
      result = await generateLandingPageContent(prompt, context);
    }, 60000);
    
    it('generates headline within length bounds', () => {
      expect(result.headline.length).toBeGreaterThanOrEqual(testCase.expectations.headlineMinLength);
      expect(result.headline.length).toBeLessThanOrEqual(testCase.expectations.headlineMaxLength);
    });
    
    it('headline avoids forbidden superlatives', () => {
      const forbidden = testCase.expectations.headlineNotContains;
      expect(containsAny(result.headline, forbidden)).toBe(false);
    });
    
    it('generates correct number of benefits', () => {
      expect(result.benefits.length).toBeGreaterThanOrEqual(testCase.expectations.benefitsMinCount);
      if (testCase.expectations.benefitsMaxCount) {
        expect(result.benefits.length).toBeLessThanOrEqual(testCase.expectations.benefitsMaxCount);
      }
    });
    
    it('includes CTA when expected', () => {
      if (testCase.expectations.hasCTA) {
        expect(result.cta).toBeDefined();
        expect(result.cta.text).toBeTruthy();
      }
    });
    
    it('benefits have both title and description', () => {
      for (const benefit of result.benefits) {
        expect(benefit.title).toBeTruthy();
        expect(benefit.description).toBeTruthy();
      }
    });
  });
});

// ============================================================================
// Claim Validation Consistency Tests
// ============================================================================

describeIfOpenRouter('Claim Validation Consistency', () => {
  describe.each(GOLDEN_CASES.claimValidation)('validates: "$input"', (testCase) => {
    let result: Awaited<ReturnType<typeof quickClaimCheck>>;
    
    beforeAll(async () => {
      result = await quickClaimCheck(testCase.input);
    }, 30000);
    
    it(`correctly identifies ${testCase.expected.riskLevel} risk level`, () => {
      expect(result.riskLevel).toBe(testCase.expected.riskLevel);
    });
    
    if (testCase.expected.requiresEvidence !== undefined) {
      it(`correctly identifies evidence requirement: ${testCase.expected.requiresEvidence}`, () => {
        expect(result.requiresEvidence).toBe(testCase.expected.requiresEvidence);
      });
    }
    
    it('provides issues array', () => {
      expect(Array.isArray(result.issues)).toBe(true);
    });
    
    if (testCase.expected.riskLevel !== 'low') {
      it('provides at least one issue for non-low risk', () => {
        expect(result.issues.length).toBeGreaterThan(0);
      });
    }
  });
});

// ============================================================================
// Batch Validation Consistency Tests
// ============================================================================

describeIfOpenRouter('Batch Validation Consistency', () => {
  it('validates multiple claims consistently', async () => {
    const claims = [
      'The best solution ever',
      'Helps teams work better',
      'Guaranteed 100% success',
    ];
    
    const results = await batchValidateClaims(claims);
    
    expect(results.length).toBe(claims.length);
    
    // First claim should be high risk
    expect(results[0].riskLevel).toBe('high');
    
    // Second claim should be low risk
    expect(results[1].riskLevel).toBe('low');
    
    // Third claim should be high risk
    expect(results[2].riskLevel).toBe('high');
  }, 30000);
  
  it('maintains consistency across multiple runs', async () => {
    const claim = 'The fastest solution available';
    
    // Run validation 3 times
    const results = await Promise.all([
      quickClaimCheck(claim),
      quickClaimCheck(claim),
      quickClaimCheck(claim),
    ]);
    
    // All should have the same risk level
    const riskLevels = results.map(r => r.riskLevel);
    expect(new Set(riskLevels).size).toBe(1);
  }, 60000);
});

// ============================================================================
// Marketing Angles Generation Tests
// ============================================================================

describeIfOpenRouter('Marketing Angles Generation', () => {
  describe.each(GOLDEN_CASES.marketingAngles)('$name', (testCase) => {
    let result: Awaited<ReturnType<typeof generateMarketingAngles>>;
    
    beforeAll(async () => {
      result = await generateMarketingAngles(testCase.input);
    }, 60000);
    
    it('generates correct number of angles', () => {
      expect(result.angles.length).toBeGreaterThanOrEqual(testCase.expectations.minAngles);
      if (testCase.expectations.maxAngles) {
        expect(result.angles.length).toBeLessThanOrEqual(testCase.expectations.maxAngles);
      }
    });
    
    it('each angle has required fields', () => {
      for (const angle of result.angles) {
        expect(angle.name).toBeTruthy();
        expect(angle.headline).toBeTruthy();
        expect(angle.emotionalHook).toBeTruthy();
        expect(angle.targetPainPoint).toBeTruthy();
      }
    });
    
    if (testCase.expectations.hasUniqueHooks) {
      it('generates unique emotional hooks', () => {
        const hooks = result.angles.map(a => a.emotionalHook.toLowerCase());
        const uniqueHooks = new Set(hooks);
        // Allow some overlap but not all same
        expect(uniqueHooks.size).toBeGreaterThan(1);
      });
    }
  });
});

// ============================================================================
// Email Sequence Generation Tests
// ============================================================================

describeIfOpenRouter('Email Sequence Generation', () => {
  it('generates complete email sequence', async () => {
    const campaign = {
      name: 'Product Launch',
      audience: 'Marketing managers',
      goal: 'Drive trial signups',
      offer: 'Free 14-day trial',
    };
    
    const emails = await generateEmailSequence(campaign, 3);
    
    expect(emails.length).toBe(3);
    
    for (const email of emails) {
      expect(email.subject).toBeTruthy();
      expect(email.subject.length).toBeLessThan(100); // Subject line best practice
      expect(email.preheader).toBeTruthy();
      expect(email.body).toBeTruthy();
      expect(email.cta).toBeTruthy();
      expect(email.sendDelay).toBeTruthy();
    }
  }, 60000);
  
  it('email subjects avoid spam triggers', async () => {
    const campaign = {
      name: 'Promo Campaign',
      audience: 'Business owners',
      goal: 'Product sales',
      offer: 'Limited time discount',
    };
    
    const emails = await generateEmailSequence(campaign, 2);
    
    const spamTriggers = ['FREE!!!', 'ACT NOW', 'LIMITED TIME', 'URGENT', '!!!'];
    
    for (const email of emails) {
      expect(containsAny(email.subject, spamTriggers)).toBe(false);
    }
  }, 60000);
});

// ============================================================================
// Quality Metrics
// ============================================================================

describeIfOpenRouter('Quality Metrics', () => {
  it('landing page content is specific, not generic', async () => {
    const prompt = 'Create landing page for DevOps engineers at Fortune 500 companies';
    const result = await generateLandingPageContent(prompt);
    
    // Check for specificity indicators
    const genericTerms = ['solutions', 'leverage', 'synergy', 'paradigm', 'holistic'];
    const headlineIsGeneric = containsAny(result.headline, genericTerms);
    
    expect(headlineIsGeneric).toBe(false);
    
    // Check that benefits are specific (have numbers or concrete outcomes)
    const hasSpecificBenefits = result.benefits.some(b => 
      /\d+/.test(b.description) || // Contains numbers
      b.description.includes('%') ||
      b.description.length > 50 // Detailed description
    );
    
    expect(hasSpecificBenefits).toBe(true);
  }, 60000);
});
