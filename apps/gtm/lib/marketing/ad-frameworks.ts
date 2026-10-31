/**
 * Marketing IQ - Ad Frameworks Library (Jan 2026)
 * 
 * 15+ proven advertising and copywriting frameworks
 * for generating high-converting marketing content.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';

// ============================================================================
// Types
// ============================================================================

export interface AdFramework {
  id: string;
  name: string;
  acronym?: string;
  description: string;
  stages: FrameworkStage[];
  bestFor: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  effectivenessScore: number; // 1-10
}

export interface FrameworkStage {
  name: string;
  letter?: string;
  description: string;
  example?: string;
  tips: string[];
}

export interface GeneratedFrameworkContent {
  framework: string;
  content: Record<string, string>;
  fullCopy: string;
  suggestions: string[];
}

// ============================================================================
// Framework Definitions (15+ frameworks)
// ============================================================================

export const AD_FRAMEWORKS: AdFramework[] = [
  // 1. AIDA - Classic attention-to-action
  {
    id: 'aida',
    name: 'Attention-Interest-Desire-Action',
    acronym: 'AIDA',
    description: 'The classic marketing funnel framework. Captures attention, builds interest, creates desire, and prompts action.',
    stages: [
      {
        name: 'Attention',
        letter: 'A',
        description: 'Grab attention with a bold headline or hook',
        example: 'Stop wasting hours on manual tasks!',
        tips: ['Use numbers or statistics', 'Ask provocative questions', 'Make bold claims'],
      },
      {
        name: 'Interest',
        letter: 'I',
        description: 'Build interest with relevant benefits',
        example: 'Our AI automates your workflow in minutes.',
        tips: ['Focus on benefits, not features', 'Use storytelling', 'Address pain points'],
      },
      {
        name: 'Desire',
        letter: 'D',
        description: 'Create emotional desire and urgency',
        example: 'Join 10,000+ teams saving 20+ hours weekly.',
        tips: ['Use social proof', 'Paint a picture of success', 'Create FOMO'],
      },
      {
        name: 'Action',
        letter: 'A',
        description: 'Clear call-to-action',
        example: 'Start your free trial now',
        tips: ['Be specific', 'Create urgency', 'Remove friction'],
      },
    ],
    bestFor: ['Landing pages', 'Email campaigns', 'Display ads'],
    difficulty: 'beginner',
    effectivenessScore: 8,
  },

  // 2. PAS - Problem-Agitate-Solution
  {
    id: 'pas',
    name: 'Problem-Agitate-Solution',
    acronym: 'PAS',
    description: 'Identify a problem, agitate it to create urgency, then present your solution.',
    stages: [
      {
        name: 'Problem',
        letter: 'P',
        description: 'Identify the specific problem your audience faces',
        example: 'Tired of losing deals to competitors?',
        tips: ['Be specific', 'Use audience language', 'Show empathy'],
      },
      {
        name: 'Agitate',
        letter: 'A',
        description: 'Intensify the pain and consequences',
        example: 'Every lost deal costs you thousands and damages team morale.',
        tips: ['Highlight consequences', 'Use emotional language', 'Be relatable'],
      },
      {
        name: 'Solution',
        letter: 'S',
        description: 'Present your product as the solution',
        example: 'Our CRM helps you close 40% more deals with AI-powered insights.',
        tips: ['Connect directly to the problem', 'Show proof', 'Make it easy'],
      },
    ],
    bestFor: ['Sales pages', 'Problem-aware audiences', 'B2B'],
    difficulty: 'beginner',
    effectivenessScore: 9,
  },

  // 3. BAB - Before-After-Bridge
  {
    id: 'bab',
    name: 'Before-After-Bridge',
    acronym: 'BAB',
    description: 'Paint the before and after picture, then bridge with your solution.',
    stages: [
      {
        name: 'Before',
        letter: 'B',
        description: 'Describe the current painful state',
        example: 'Your team spends 10+ hours weekly on manual reporting.',
        tips: ['Be specific about current pain', 'Use relatable scenarios'],
      },
      {
        name: 'After',
        letter: 'A',
        description: 'Show the transformed future state',
        example: 'Imagine having automated reports ready every morning.',
        tips: ['Paint a vivid picture', 'Focus on outcomes', 'Make it aspirational'],
      },
      {
        name: 'Bridge',
        letter: 'B',
        description: 'Explain how your product bridges the gap',
        example: 'Our platform automates everything in 3 clicks.',
        tips: ['Be the hero', 'Show the path clearly', 'Remove objections'],
      },
    ],
    bestFor: ['Transformation stories', 'Email sequences', 'Social ads'],
    difficulty: 'beginner',
    effectivenessScore: 8,
  },

  // 4. PASTOR - Problem-Amplify-Story-Transformation-Offer-Response
  {
    id: 'pastor',
    name: 'Problem-Amplify-Story-Transformation-Offer-Response',
    acronym: 'PASTOR',
    description: 'A comprehensive framework that uses storytelling for deep emotional connection.',
    stages: [
      { name: 'Problem', letter: 'P', description: 'Identify the core problem', tips: ['Be specific'] },
      { name: 'Amplify', letter: 'A', description: 'Amplify consequences of not solving', tips: ['Use data'] },
      { name: 'Story', letter: 'S', description: 'Tell a relatable story', tips: ['Use real examples'] },
      { name: 'Transformation', letter: 'T', description: 'Show the transformation possible', tips: ['Be vivid'] },
      { name: 'Offer', letter: 'O', description: 'Present your offer clearly', tips: ['Stack value'] },
      { name: 'Response', letter: 'R', description: 'Ask for the response/action', tips: ['Be direct'] },
    ],
    bestFor: ['Long-form sales pages', 'Webinars', 'Course sales'],
    difficulty: 'advanced',
    effectivenessScore: 9,
  },

  // 5. FAB - Features-Advantages-Benefits
  {
    id: 'fab',
    name: 'Features-Advantages-Benefits',
    acronym: 'FAB',
    description: 'Connect product features to real benefits customers care about.',
    stages: [
      { name: 'Features', letter: 'F', description: 'List the product feature', tips: ['Be factual'] },
      { name: 'Advantages', letter: 'A', description: 'Explain the advantage', tips: ['Show the "so what"'] },
      { name: 'Benefits', letter: 'B', description: 'Connect to emotional benefit', tips: ['Make it personal'] },
    ],
    bestFor: ['Product descriptions', 'Feature announcements', 'Comparison pages'],
    difficulty: 'beginner',
    effectivenessScore: 7,
  },

  // 6. 4Ps - Promise-Picture-Proof-Push
  {
    id: '4ps',
    name: 'Promise-Picture-Proof-Push',
    acronym: '4Ps',
    description: 'Make a promise, paint a picture, prove it, then push to action.',
    stages: [
      { name: 'Promise', letter: 'P', description: 'Make a bold promise', tips: ['Be specific', 'Be believable'] },
      { name: 'Picture', letter: 'P', description: 'Paint the outcome picture', tips: ['Use sensory language'] },
      { name: 'Proof', letter: 'P', description: 'Provide social proof', tips: ['Use numbers', 'Show testimonials'] },
      { name: 'Push', letter: 'P', description: 'Push toward action', tips: ['Create urgency'] },
    ],
    bestFor: ['Headlines', 'Ad copy', 'Product launches'],
    difficulty: 'intermediate',
    effectivenessScore: 8,
  },

  // 7. QUEST - Qualify-Understand-Educate-Stimulate-Transition
  {
    id: 'quest',
    name: 'Qualify-Understand-Educate-Stimulate-Transition',
    acronym: 'QUEST',
    description: 'Qualify leads, demonstrate understanding, educate, stimulate action.',
    stages: [
      { name: 'Qualify', letter: 'Q', description: 'Qualify the reader', tips: ['Call out your audience'] },
      { name: 'Understand', letter: 'U', description: 'Show you understand', tips: ['Empathize'] },
      { name: 'Educate', letter: 'E', description: 'Educate on the solution', tips: ['Provide value'] },
      { name: 'Stimulate', letter: 'S', description: 'Stimulate desire', tips: ['Use benefits'] },
      { name: 'Transition', letter: 'T', description: 'Transition to action', tips: ['Smooth CTA'] },
    ],
    bestFor: ['Educational content', 'Lead magnets', 'Email nurture'],
    difficulty: 'intermediate',
    effectivenessScore: 7,
  },

  // 8. SLAP - Stop-Look-Act-Purchase
  {
    id: 'slap',
    name: 'Stop-Look-Act-Purchase',
    acronym: 'SLAP',
    description: 'Fast-paced framework for attention-grabbing ads.',
    stages: [
      { name: 'Stop', letter: 'S', description: 'Stop the scroll', tips: ['Bold visuals', 'Shocking stats'] },
      { name: 'Look', letter: 'L', description: 'Get them to look closer', tips: ['Curiosity gap'] },
      { name: 'Act', letter: 'A', description: 'Inspire action', tips: ['Clear benefit'] },
      { name: 'Purchase', letter: 'P', description: 'Drive purchase', tips: ['Easy checkout'] },
    ],
    bestFor: ['Social media ads', 'Banner ads', 'Short video ads'],
    difficulty: 'beginner',
    effectivenessScore: 7,
  },

  // 9. STAR - Situation-Task-Action-Result
  {
    id: 'star',
    name: 'Situation-Task-Action-Result',
    acronym: 'STAR',
    description: 'Storytelling framework perfect for case studies and testimonials.',
    stages: [
      { name: 'Situation', letter: 'S', description: 'Set the scene', tips: ['Context matters'] },
      { name: 'Task', letter: 'T', description: 'Define the challenge', tips: ['Make it relatable'] },
      { name: 'Action', letter: 'A', description: 'Describe what was done', tips: ['Be specific'] },
      { name: 'Result', letter: 'R', description: 'Share the outcome', tips: ['Use metrics'] },
    ],
    bestFor: ['Case studies', 'Testimonials', 'Success stories'],
    difficulty: 'beginner',
    effectivenessScore: 8,
  },

  // 10. PPPP - Picture-Promise-Prove-Push
  {
    id: 'pppp',
    name: 'Picture-Promise-Prove-Push',
    acronym: 'PPPP',
    description: 'Visual-first approach that leads with imagination.',
    stages: [
      { name: 'Picture', letter: 'P', description: 'Paint a vivid picture', tips: ['Use imagery'] },
      { name: 'Promise', letter: 'P', description: 'Make your promise', tips: ['Be bold'] },
      { name: 'Prove', letter: 'P', description: 'Back it up', tips: ['Data and testimonials'] },
      { name: 'Push', letter: 'P', description: 'Push for action', tips: ['Create urgency'] },
    ],
    bestFor: ['Visual ads', 'Instagram', 'Pinterest'],
    difficulty: 'intermediate',
    effectivenessScore: 7,
  },

  // 11. ACCA - Awareness-Comprehension-Conviction-Action
  {
    id: 'acca',
    name: 'Awareness-Comprehension-Conviction-Action',
    acronym: 'ACCA',
    description: 'Build awareness, ensure comprehension, create conviction, drive action.',
    stages: [
      { name: 'Awareness', letter: 'A', description: 'Create awareness of the need', tips: ['Educate first'] },
      { name: 'Comprehension', letter: 'C', description: 'Help them understand', tips: ['Simplify'] },
      { name: 'Conviction', letter: 'C', description: 'Build conviction to buy', tips: ['Address objections'] },
      { name: 'Action', letter: 'A', description: 'Drive to action', tips: ['Clear CTA'] },
    ],
    bestFor: ['New markets', 'Complex products', 'Educational funnels'],
    difficulty: 'advanced',
    effectivenessScore: 7,
  },

  // 12. FOREST - Facts-Opinions-References-Examples-Statistics-Testimony
  {
    id: 'forest',
    name: 'Facts-Opinions-References-Examples-Statistics-Testimony',
    acronym: 'FOREST',
    description: 'Evidence-heavy framework for building trust and credibility.',
    stages: [
      { name: 'Facts', letter: 'F', description: 'State relevant facts', tips: ['Be accurate'] },
      { name: 'Opinions', letter: 'O', description: 'Share expert opinions', tips: ['Quote authorities'] },
      { name: 'References', letter: 'R', description: 'Cite references', tips: ['Link to sources'] },
      { name: 'Examples', letter: 'E', description: 'Provide examples', tips: ['Make them relatable'] },
      { name: 'Statistics', letter: 'S', description: 'Use statistics', tips: ['Visualize data'] },
      { name: 'Testimony', letter: 'T', description: 'Include testimonials', tips: ['Real names and faces'] },
    ],
    bestFor: ['B2B', 'High-ticket sales', 'Skeptical audiences'],
    difficulty: 'advanced',
    effectivenessScore: 8,
  },

  // 13. AIDCA - Attention-Interest-Desire-Conviction-Action
  {
    id: 'aidca',
    name: 'Attention-Interest-Desire-Conviction-Action',
    acronym: 'AIDCA',
    description: 'Extended AIDA with conviction-building for higher-priced items.',
    stages: [
      { name: 'Attention', letter: 'A', description: 'Capture attention', tips: ['Bold opening'] },
      { name: 'Interest', letter: 'I', description: 'Build interest', tips: ['Relevance'] },
      { name: 'Desire', letter: 'D', description: 'Create desire', tips: ['Benefits focus'] },
      { name: 'Conviction', letter: 'C', description: 'Build conviction with proof', tips: ['Social proof'] },
      { name: 'Action', letter: 'A', description: 'Drive action', tips: ['Risk reversal'] },
    ],
    bestFor: ['High-ticket items', 'B2B enterprise', 'Considered purchases'],
    difficulty: 'intermediate',
    effectivenessScore: 8,
  },

  // 14. USP - Unique Selling Proposition
  {
    id: 'usp',
    name: 'Unique Selling Proposition',
    acronym: 'USP',
    description: 'Focus on what makes you uniquely valuable vs competitors.',
    stages: [
      { name: 'Unique', letter: 'U', description: 'What makes you different', tips: ['Be specific'] },
      { name: 'Selling', letter: 'S', description: 'Why this matters to buyers', tips: ['Benefits focus'] },
      { name: 'Proposition', letter: 'P', description: 'The clear value statement', tips: ['Memorable'] },
    ],
    bestFor: ['Brand positioning', 'Taglines', 'Competitive markets'],
    difficulty: 'intermediate',
    effectivenessScore: 8,
  },

  // 15. SCQA - Situation-Complication-Question-Answer
  {
    id: 'scqa',
    name: 'Situation-Complication-Question-Answer',
    acronym: 'SCQA',
    description: 'McKinsey-style framework for structured persuasion.',
    stages: [
      { name: 'Situation', letter: 'S', description: 'Establish the current situation', tips: ['Common ground'] },
      { name: 'Complication', letter: 'C', description: 'Introduce the complication', tips: ['The "but"'] },
      { name: 'Question', letter: 'Q', description: 'Pose the key question', tips: ['Engage curiosity'] },
      { name: 'Answer', letter: 'A', description: 'Provide the answer', tips: ['Your solution'] },
    ],
    bestFor: ['Consulting', 'Presentations', 'Executive summaries'],
    difficulty: 'intermediate',
    effectivenessScore: 7,
  },

  // 16. SSS - Star-Story-Solution
  {
    id: 'sss',
    name: 'Star-Story-Solution',
    acronym: 'SSS',
    description: 'Narrative-driven framework featuring a relatable protagonist.',
    stages: [
      { name: 'Star', letter: 'S', description: 'Introduce the star/protagonist', tips: ['Make them relatable'] },
      { name: 'Story', letter: 'S', description: 'Tell their story/struggle', tips: ['Build empathy'] },
      { name: 'Solution', letter: 'S', description: 'How they found the solution', tips: ['Natural transition'] },
    ],
    bestFor: ['Video ads', 'Personal brands', 'Emotional products'],
    difficulty: 'beginner',
    effectivenessScore: 8,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get framework by ID
 */
export function getFramework(id: string): AdFramework | undefined {
  return AD_FRAMEWORKS.find(f => f.id === id);
}

/**
 * Get frameworks for a use case
 */
export function getFrameworksForUseCase(useCase: string): AdFramework[] {
  return AD_FRAMEWORKS.filter(f => 
    f.bestFor.some(u => u.toLowerCase().includes(useCase.toLowerCase()))
  );
}

/**
 * Get frameworks by difficulty
 */
export function getFrameworksByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): AdFramework[] {
  return AD_FRAMEWORKS.filter(f => f.difficulty === difficulty);
}

/**
 * Get all frameworks sorted by effectiveness
 */
export function getFrameworksByEffectiveness(): AdFramework[] {
  return [...AD_FRAMEWORKS].sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

// ============================================================================
// AI Generation
// ============================================================================

const frameworkContentSchema = z.object({
  stages: z.record(z.string()),
  fullCopy: z.string(),
  suggestions: z.array(z.string()),
});

/**
 * Generate content using a specific framework
 */
export async function generateWithFramework(
  frameworkId: string,
  context: {
    product: string;
    targetAudience: string;
    goal: string;
    tone?: string;
    additionalContext?: string;
  }
): Promise<GeneratedFrameworkContent> {
  const framework = getFramework(frameworkId);
  if (!framework) {
    throw new Error(`Unknown framework: ${frameworkId}`);
  }

  const stagePrompts = framework.stages
    .map(s => `- ${s.name}: ${s.description}`)
    .join('\n');

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: frameworkContentSchema,
    system: `You are an expert copywriter using the ${framework.name} (${framework.acronym}) framework.

Framework stages:
${stagePrompts}

Best used for: ${framework.bestFor.join(', ')}

Create compelling marketing copy following this framework exactly.`,
    prompt: `Create ${framework.acronym} copy for:

Product/Service: ${context.product}
Target Audience: ${context.targetAudience}
Goal: ${context.goal}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.additionalContext ? `Additional Context: ${context.additionalContext}` : ''}

Generate:
1. Content for each stage of the framework
2. A combined full copy
3. 3 suggestions for improvement`,
    temperature: 0.7,
  });

  return {
    framework: frameworkId,
    content: (object as any).stages,
    fullCopy: (object as any).fullCopy,
    suggestions: (object as any).suggestions,
  };
}

/**
 * Suggest best frameworks for a given context
 */
export async function suggestFrameworks(
  context: {
    product: string;
    goal: string;
    audience: string;
    contentType: string;
  }
): Promise<{ frameworks: AdFramework[]; reasoning: string[] }> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      recommended: z.array(z.string()),
      reasoning: z.array(z.string()),
    }),
    system: `You are a marketing strategy expert. Recommend the best copywriting frameworks.

Available frameworks: ${AD_FRAMEWORKS.map(f => f.id).join(', ')}`,
    prompt: `Recommend 3-5 frameworks for:
Product: ${context.product}
Goal: ${context.goal}
Audience: ${context.audience}
Content type: ${context.contentType}

Return framework IDs and reasoning.`,
    temperature: 0.3,
  });

  const frameworks = (object as any).recommended
    .map((id: string) => getFramework(id))
    .filter((f: any): f is AdFramework => f !== undefined);

  return {
    frameworks,
    reasoning: (object as any).reasoning,
  };
}
