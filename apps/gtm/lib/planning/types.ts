import { z } from 'zod'

export const DecisionStageSchema = z.enum(['discover', 'evaluate', 'justify', 'convert'])
export type DecisionStage = z.infer<typeof DecisionStageSchema>

export const ProofStrategySchema = z.enum([
  'product-proof',
  'customer-proof',
  'evidence-stack',
  'compliance-proof',
])
export type ProofStrategy = z.infer<typeof ProofStrategySchema>

export const PlanningActorRoleSchema = z.enum([
  'buyer',
  'evaluator',
  'approver',
  'operator',
  'champion',
])
export type PlanningActorRole = z.infer<typeof PlanningActorRoleSchema>

export const PlanningActorSchema = z.object({
  label: z.string(),
  role: PlanningActorRoleSchema,
  goal: z.string(),
  concerns: z.array(z.string()),
})
export type PlanningActor = z.infer<typeof PlanningActorSchema>

export const PlanAssetTypeSchema = z.enum(['landing-page', 'email', 'social', 'deck'])
export type PlanAssetType = z.infer<typeof PlanAssetTypeSchema>

export const AssetBlueprintSchema = z.object({
  assetType: PlanAssetTypeSchema,
  objective: z.string(),
  requiredSections: z.array(z.string()),
  proofRequirements: z.array(z.string()),
  channelNotes: z.string(),
})
export type AssetBlueprint = z.infer<typeof AssetBlueprintSchema>

export const CreativeRouteBiasSchema = z.enum([
  'trust',
  'product',
  'editorial',
  'technical',
  'conversion',
])
export type CreativeRouteBias = z.infer<typeof CreativeRouteBiasSchema>

export const CreativeRouteSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  headlineAngle: z.string(),
  proofPosture: z.enum(['light', 'balanced', 'heavy']),
  visualBias: CreativeRouteBiasSchema,
  restraint: z.enum(['strict', 'balanced', 'expressive']),
  heroFraming: z.enum(['proof-led', 'product-led', 'editorial-story', 'technical-brief', 'direct-offer']),
  proofPlacement: z.enum(['hero', 'mid', 'late']),
  typographyMode: z.enum(['trust', 'product', 'editorial', 'technical', 'conversion']),
  ctaStyle: z.enum(['solid', 'outline', 'pill']),
  motionPolicy: z.enum(['none', 'subtle', 'emphasis']),
  ornamentAllowance: z.enum(['none', 'low', 'medium']),
  visualDensity: z.enum(['airy', 'balanced', 'compact']),
  landingOrder: z.array(z.string()).min(3),
  confidence: z.number().min(0).max(1),
})
export type CreativeRoute = z.infer<typeof CreativeRouteSchema>

export const PlanConstraintsSchema = z.object({
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  proofBlockers: z.array(z.string()),
  visualBans: z.array(z.string()),
})
export type PlanConstraints = z.infer<typeof PlanConstraintsSchema>

export const GenerationPlanSchema = z.object({
  objective: z.string(),
  summary: z.string(),
  primaryActor: PlanningActorSchema,
  secondaryActor: PlanningActorSchema.optional(),
  decisionStage: DecisionStageSchema,
  proofStrategy: ProofStrategySchema,
  constraints: PlanConstraintsSchema,
  assetBlueprints: z.array(AssetBlueprintSchema),
  creativeRoutes: z.array(CreativeRouteSchema).min(1),
  selectedRoute: z.string(),
  source: z.enum(['brand', 'brain', 'fallback']),
})
export type GenerationPlan = z.infer<typeof GenerationPlanSchema>

export const ReviewSignalKeySchema = z.enum([
  'brandFit',
  'restraint',
  'proofCoverage',
  'actorFit',
  'hierarchyClarity',
  'routeFidelity',
  'channelFit',
  'distinctiveness',
])
export type ReviewSignalKey = z.infer<typeof ReviewSignalKeySchema>

export const ReviewSignalSchema = z.object({
  key: ReviewSignalKeySchema,
  label: z.string(),
  score: z.number().min(0).max(100),
  summary: z.string(),
})
export type ReviewSignal = z.infer<typeof ReviewSignalSchema>

export const OutputEvaluationIssueCodeSchema = z.enum([
  'purple_gradient_default',
  'fake_dashboard_chrome',
  'decorative_motion',
  'hover_gimmick',
  'glassmorphism_overuse',
  'accent_color_scatter',
  'weak_contrast',
  'generic_filler_copy',
  'templated_section_stack',
  'route_mismatch',
  'weak_proof',
  'actor_mismatch',
  'weak_hierarchy',
  'channel_mismatch',
])
export type OutputEvaluationIssueCode = z.infer<typeof OutputEvaluationIssueCodeSchema>

export const OutputEvaluationIssueSchema = z.object({
  code: OutputEvaluationIssueCodeSchema,
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  detail: z.string().optional(),
})
export type OutputEvaluationIssue = z.infer<typeof OutputEvaluationIssueSchema>

export const OutputEvaluationSchema = z.object({
  assetType: PlanAssetTypeSchema,
  scores: z.object({
    distinctiveness: z.number().min(0).max(100),
    brandFit: z.number().min(0).max(100),
    proofCoverage: z.number().min(0).max(100),
    actorFit: z.number().min(0).max(100),
    hierarchyClarity: z.number().min(0).max(100),
    restraint: z.number().min(0).max(100),
    routeFidelity: z.number().min(0).max(100),
    channelFit: z.number().min(0).max(100),
  }),
  issues: z.array(OutputEvaluationIssueSchema),
  strengths: z.array(z.string()),
  preserve: z.array(z.string()),
  suggestedActions: z.array(z.string()),
})
export type OutputEvaluation = z.infer<typeof OutputEvaluationSchema>

export const ReviewActionSchema = z.enum([
  'make-product-clearer',
  'increase-proof',
  'reduce-ornament',
  'tighten-hierarchy',
  'shift-trust',
  'shift-product',
  'shift-editorial',
  'shift-technical',
  'shift-conversion',
])
export type ReviewActionId = z.infer<typeof ReviewActionSchema>
