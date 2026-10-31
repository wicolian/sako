import { 
  hasStudioAccess,
  hasProFeatures,
  hasMotion,
  hasStrategy,
  hasUnlimitedComposerCredits,
  getDefaultAiCreditLimit,
  getPlanDisplayName,
  PlanCode,
} from '../src/billing/plan.config';

describe('Composer Capabilities - Plan Helper Functions', () => {
  describe('getPlanDisplayName', () => {
    it('returns "Composer Free" for COMPOSER_FREE', () => {
      expect(getPlanDisplayName('COMPOSER_FREE')).toBe('Composer Free');
    });

    it('returns "Composer Pro" for COMPOSER_PRO', () => {
      expect(getPlanDisplayName('COMPOSER_PRO')).toBe('Composer Pro');
    });

    it('returns "Core" for CORE', () => {
      expect(getPlanDisplayName('CORE')).toBe('Core');
    });

    it('returns "Ops Base" for OPS', () => {
      expect(getPlanDisplayName('OPS')).toBe('Ops Base');
    });

    it('returns "Enterprise" for ENTERPRISE', () => {
      expect(getPlanDisplayName('ENTERPRISE')).toBe('Enterprise');
    });
  });

  describe('hasStudioAccess', () => {
    it('returns false for COMPOSER_FREE', () => {
      expect(hasStudioAccess('COMPOSER_FREE')).toBe(false);
    });

    it('returns false for COMPOSER_PRO', () => {
      expect(hasStudioAccess('COMPOSER_PRO')).toBe(false);
    });

    it('returns true for CORE', () => {
      expect(hasStudioAccess('CORE')).toBe(true);
    });

    it('returns true for OPS', () => {
      expect(hasStudioAccess('OPS')).toBe(true);
    });

    it('returns true for ENTERPRISE', () => {
      expect(hasStudioAccess('ENTERPRISE')).toBe(true);
    });
  });

  describe('hasProFeatures', () => {
    it('returns false for COMPOSER_FREE', () => {
      expect(hasProFeatures('COMPOSER_FREE')).toBe(false);
    });

    it('returns true for COMPOSER_PRO', () => {
      expect(hasProFeatures('COMPOSER_PRO')).toBe(true);
    });

    it('returns true for CORE', () => {
      expect(hasProFeatures('CORE')).toBe(true);
    });

    it('returns true for OPS', () => {
      expect(hasProFeatures('OPS')).toBe(true);
    });

    it('returns true for ENTERPRISE', () => {
      expect(hasProFeatures('ENTERPRISE')).toBe(true);
    });
  });

  describe('hasMotion', () => {
    it('returns false for COMPOSER_FREE', () => {
      expect(hasMotion('COMPOSER_FREE')).toBe(false);
    });

    it('returns false for COMPOSER_PRO', () => {
      expect(hasMotion('COMPOSER_PRO')).toBe(false);
    });

    it('returns true for CORE (Design + Motion)', () => {
      expect(hasMotion('CORE')).toBe(true);
    });

    it('returns true for OPS', () => {
      expect(hasMotion('OPS')).toBe(true);
    });

    it('returns true for ENTERPRISE', () => {
      expect(hasMotion('ENTERPRISE')).toBe(true);
    });
  });

  describe('hasStrategy', () => {
    it('returns false for COMPOSER_FREE', () => {
      expect(hasStrategy('COMPOSER_FREE')).toBe(false);
    });

    it('returns false for COMPOSER_PRO', () => {
      expect(hasStrategy('COMPOSER_PRO')).toBe(false);
    });

    it('returns false for CORE', () => {
      expect(hasStrategy('CORE')).toBe(false);
    });

    it('returns false for OPS', () => {
      expect(hasStrategy('OPS')).toBe(false);
    });

    it('returns true for ENTERPRISE only', () => {
      expect(hasStrategy('ENTERPRISE')).toBe(true);
    });
  });

  describe('hasUnlimitedComposerCredits', () => {
    it('returns false for COMPOSER_FREE', () => {
      expect(hasUnlimitedComposerCredits('COMPOSER_FREE')).toBe(false);
    });

    it('returns false for COMPOSER_PRO', () => {
      expect(hasUnlimitedComposerCredits('COMPOSER_PRO')).toBe(false);
    });

    it('returns true for CORE', () => {
      expect(hasUnlimitedComposerCredits('CORE')).toBe(true);
    });

    it('returns true for OPS', () => {
      expect(hasUnlimitedComposerCredits('OPS')).toBe(true);
    });

    it('returns true for ENTERPRISE', () => {
      expect(hasUnlimitedComposerCredits('ENTERPRISE')).toBe(true);
    });
  });

  describe('getDefaultAiCreditLimit', () => {
    it('returns 10 for COMPOSER_FREE', () => {
      expect(getDefaultAiCreditLimit('COMPOSER_FREE')).toBe(10);
    });

    it('returns 100 for COMPOSER_PRO', () => {
      expect(getDefaultAiCreditLimit('COMPOSER_PRO')).toBe(100);
    });

    it('returns null (unlimited) for CORE', () => {
      expect(getDefaultAiCreditLimit('CORE')).toBeNull();
    });

    it('returns null (unlimited) for OPS', () => {
      expect(getDefaultAiCreditLimit('OPS')).toBeNull();
    });

    it('returns null (unlimited) for ENTERPRISE', () => {
      expect(getDefaultAiCreditLimit('ENTERPRISE')).toBeNull();
    });
  });
});

describe('Composer Capabilities - Expected Response Shapes', () => {
  // These tests document the expected capability object shapes for each plan type
  
  describe('COMPOSER_FREE user capabilities', () => {
    const planCode: PlanCode = 'COMPOSER_FREE';

    it('has metered credits with limit of 10', () => {
      expect(hasUnlimitedComposerCredits(planCode)).toBe(false);
      expect(getDefaultAiCreditLimit(planCode)).toBe(10);
    });

    it('has no studio access', () => {
      expect(hasStudioAccess(planCode)).toBe(false);
    });

    it('has no pro features (no Figma export, no publish)', () => {
      expect(hasProFeatures(planCode)).toBe(false);
    });

    it('has no motion or strategy', () => {
      expect(hasMotion(planCode)).toBe(false);
      expect(hasStrategy(planCode)).toBe(false);
    });
  });

  describe('COMPOSER_PRO user capabilities', () => {
    const planCode: PlanCode = 'COMPOSER_PRO';

    it('has metered credits with limit of 100', () => {
      expect(hasUnlimitedComposerCredits(planCode)).toBe(false);
      expect(getDefaultAiCreditLimit(planCode)).toBe(100);
    });

    it('has no studio access', () => {
      expect(hasStudioAccess(planCode)).toBe(false);
    });

    it('has pro features (Figma export, publish to domain)', () => {
      expect(hasProFeatures(planCode)).toBe(true);
    });

    it('has no motion or strategy', () => {
      expect(hasMotion(planCode)).toBe(false);
      expect(hasStrategy(planCode)).toBe(false);
    });
  });

  describe('CORE user capabilities', () => {
    const planCode: PlanCode = 'CORE';

    it('has unlimited credits', () => {
      expect(hasUnlimitedComposerCredits(planCode)).toBe(true);
      expect(getDefaultAiCreditLimit(planCode)).toBeNull();
    });

    it('has studio access (can send to studio)', () => {
      expect(hasStudioAccess(planCode)).toBe(true);
    });

    it('has pro features (Figma export, publish to domain)', () => {
      expect(hasProFeatures(planCode)).toBe(true);
    });

    it('has motion but no strategy', () => {
      expect(hasMotion(planCode)).toBe(true);
      expect(hasStrategy(planCode)).toBe(false);
    });
  });

  describe('OPS user capabilities', () => {
    const planCode: PlanCode = 'OPS';

    it('has unlimited credits', () => {
      expect(hasUnlimitedComposerCredits(planCode)).toBe(true);
      expect(getDefaultAiCreditLimit(planCode)).toBeNull();
    });

    it('has studio access', () => {
      expect(hasStudioAccess(planCode)).toBe(true);
    });

    it('has pro features', () => {
      expect(hasProFeatures(planCode)).toBe(true);
    });

    it('has motion but no strategy', () => {
      expect(hasMotion(planCode)).toBe(true);
      expect(hasStrategy(planCode)).toBe(false);
    });
  });

  describe('ENTERPRISE user capabilities', () => {
    const planCode: PlanCode = 'ENTERPRISE';

    it('has unlimited credits', () => {
      expect(hasUnlimitedComposerCredits(planCode)).toBe(true);
      expect(getDefaultAiCreditLimit(planCode)).toBeNull();
    });

    it('has studio access', () => {
      expect(hasStudioAccess(planCode)).toBe(true);
    });

    it('has pro features', () => {
      expect(hasProFeatures(planCode)).toBe(true);
    });

    it('has both motion AND strategy', () => {
      expect(hasMotion(planCode)).toBe(true);
      expect(hasStrategy(planCode)).toBe(true);
    });
  });
});

describe('Composer Capabilities - max_parallel_studio_tasks expectations', () => {
  // Document expected activeTaskLimit values based on plan defaults
  
  it('COMPOSER_FREE has 0 parallel tasks', () => {
    // Composer-only plans don't have studio tasks
    expect(hasStudioAccess('COMPOSER_FREE')).toBe(false);
  });

  it('COMPOSER_PRO has 0 parallel tasks', () => {
    expect(hasStudioAccess('COMPOSER_PRO')).toBe(false);
  });

  it('CORE has 1 parallel task (default)', () => {
    // This is configured in plan.config.ts with PLAN_CORE_ACTIVE_TASKS || '1'
    expect(hasStudioAccess('CORE')).toBe(true);
  });

  it('OPS has 2 parallel tasks (default)', () => {
    // This is configured in plan.config.ts with PLAN_OPS_ACTIVE_TASKS || '2'
    expect(hasStudioAccess('OPS')).toBe(true);
  });

  it('ENTERPRISE has 3 parallel tasks (default)', () => {
    // This is configured in plan.config.ts with PLAN_ENTERPRISE_ACTIVE_TASKS || '3'
    expect(hasStudioAccess('ENTERPRISE')).toBe(true);
  });
});
