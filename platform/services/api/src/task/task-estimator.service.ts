import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { EstimateTaskDto, TaskEstimatorResponseDto, TaskEstimatorResult } from './dto/estimator.dto';
import { TaskCategory } from '@prisma/client';

@Injectable()
export class TaskEstimatorService {
  private readonly logger = new Logger(TaskEstimatorService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) { }

  /**
   * Estimates a task using AI and returns the result.
   * This does NOT create a Task entity, but can optionally persist
   * the snapshot if a taskId is provided later.
   */
  async estimateTask(
    workspaceId: string,
    input: EstimateTaskDto,
  ): Promise<TaskEstimatorResponseDto> {
    // Load workspace with subscription and plan
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: true,
        plan: true,
      },
    });

    if (!workspace) {
      throw new BadRequestException('Workspace not found');
    }

    if (!workspace.subscription) {
      throw new BadRequestException('No active subscription found');
    }

    const subscription = workspace.subscription;
    const planCode = subscription.planCode;

    // Compute standard SLA in hours (default 48h = 172800 seconds)
    const standardSlaSeconds = subscription.slaSeconds ?? 172800;
    const standardSlaHours = Math.round(standardSlaSeconds / 3600);

    // Compute active task slots based on plan and subscription
    const activeSlots = subscription.activeTaskLimit ?? workspace.plan?.activeTaskLimit ?? 1;

    // Load brand if specified
    let brandName: string | undefined;
    let brandSummary: string | undefined;
    if (input.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: input.brandId, workspaceId },
      });
      if (brand) {
        brandName = brand.name;
        brandSummary = brand.guidelines
          ? brand.guidelines.substring(0, 500)
          : `Brand with tone: ${brand.toneTags.join(', ')}`;
      }
    }

    // Build the prompt
    // Note: subscriptionMode is deprecated. All plans now have FULL scope (Design + Motion).
    const prompt = this.buildPrompt({
      planCode: planCode,
      subscriptionMode: 'FULL', // Deprecated: was subscription.mode
      standardSlaHours,
      activeSlots,
      title: input.title,
      description: input.description,
      tags: input.tags,
      category: input.category,
      brandName,
      brandSummary,
      structuredBriefJson: input.structuredBriefJson,
    });

    // Call AI service
    const rawResponse = await this.aiService.estimateTask(prompt);

    // Parse the JSON response
    let result: TaskEstimatorResult;
    try {
      result = JSON.parse(rawResponse) as TaskEstimatorResult;
    } catch (err) {
      this.logger.error('Failed to parse AI response', err);
      throw new BadRequestException('AI returned invalid JSON');
    }

    // Persist snapshot
    try {
      // We don't have a taskId yet, pass null
      await this.persistEstimateSnapshot(null, workspaceId, input, result, 'gpt-4o-mini');
    } catch (e) {
      this.logger.error('Failed to persist estimate snapshot', e);
    }

    // Validate required fields
    if (
      typeof result.estimated_effort_hours !== 'number' ||
      typeof result.display_sla_hours !== 'number' ||
      !result.complexity ||
      typeof result.complexity_score !== 'number'
    ) {
      throw new BadRequestException('AI response missing required fields');
    }

    // Clamp values
    const clampedEffort = this.clamp(result.estimated_effort_hours, 8, 80);
    const clampedSla = this.clamp(result.display_sla_hours, 24, standardSlaHours);

    // Build response DTO
    const response: TaskEstimatorResponseDto = {
      estimatedEffortHours: clampedEffort,
      displaySlaHours: clampedSla,
      complexity: result.complexity,
      complexityScore: result.complexity_score,
      isAiSupported: result.is_ai_supported,
      unsupportedReason: result.unsupported_reason,
      fits48hWindow: result.fits_48h_window,
      flagForAdminReview: result.flag_for_admin_review,
      flagReason: result.flag_reason,
      recommendedSplitCount: result.recommended_split_count,
      suggestedSubtasks: result.suggested_subtasks || [],
      missingInfoQuestions: result.missing_info_questions || [],
      aiHelpRecommended: result.ai_help_recommended,
      aiHelpReason: result.ai_help_reason,
      reasoning: result.reasoning,
    };

    return response;
  }

  /**
   * Persists an estimate snapshot to the database for a given task.
   * This is called after a task is created or when we want to log the estimate.
   */
  async persistEstimateSnapshot(
    taskId: string | null,
    workspaceId: string,
    input: EstimateTaskDto,
    rawResult: TaskEstimatorResult,
    modelName: string,
  ): Promise<void> {
    // Load workspace context
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace || !workspace.subscription) {
      return;
    }

    const subscription = workspace.subscription;
    const standardSlaHours = Math.round((subscription.slaSeconds ?? 172800) / 3600);
    const activeSlots = subscription.activeTaskLimit ?? 1;

    let brandName: string | undefined;
    if (input.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: input.brandId, workspaceId },
      });
      brandName = brand?.name;
    }

    await this.prisma.taskEstimateSnapshot.create({
      data: {
        workspaceId,
        taskId: taskId ?? undefined,
        title: input.title,
        description: input.description,
        category: input.category || TaskCategory.DESIGN,
        tagsJson: input.tags || [],
        structuredBriefJson: input.structuredBriefJson ?? undefined,
        brandId: input.brandId,
        brandName,
        planCode: subscription.planCode,
        subscriptionMode: subscription.mode,
        activeTaskSlots: activeSlots,
        standardSlaHours,
        estimatedEffortHoursRaw: rawResult.estimated_effort_hours,
        displaySlaHoursRaw: rawResult.display_sla_hours,
        complexity: rawResult.complexity,
        complexityScore: rawResult.complexity_score,
        isAiSupported: rawResult.is_ai_supported,
        fits48hWindow: rawResult.fits_48h_window,
        flagForAdminReview: rawResult.flag_for_admin_review,
        flagReason: rawResult.flag_reason,
        recommendedSplitCount: rawResult.recommended_split_count,
        suggestedSubtasksJson: rawResult.suggested_subtasks,
        missingInfoJson: rawResult.missing_info_questions,
        aiHelpRecommended: rawResult.ai_help_recommended,
        aiHelpReason: rawResult.ai_help_reason,
        reasoning: rawResult.reasoning,
        modelName,
      },
    });
  }

  private buildPrompt(params: {
    planCode: string;
    subscriptionMode: string;
    standardSlaHours: number;
    activeSlots: number;
    title: string;
    description: string;
    tags?: string[];
    category?: TaskCategory;
    brandName?: string;
    brandSummary?: string;
    structuredBriefJson?: any;
  }): string {
    const {
      planCode,
      subscriptionMode,
      standardSlaHours,
      activeSlots,
      title,
      description,
      tags,
      category,
      brandName,
      brandSummary,
      structuredBriefJson,
    } = params;

    const structuredBriefText = structuredBriefJson
      ? JSON.stringify(structuredBriefJson, null, 2)
      : 'None';

    return `You are an AI task estimator and advisor for SAKO, a productized design & motion subscription service.

Context:
- Plan: ${planCode} (CORE = 1 active task, OPS = 2 active tasks, ENTERPRISE = custom).
- Subscription mode: ${subscriptionMode} (DESIGN_ONLY, MOTION_ONLY, or FULL for both).
- Standard SLA target (per active task): ${standardSlaHours} hours (usually 48).
- Active task slots: ${activeSlots} (derived from plan + subscription).
- This estimator is FREE for the user. It NEVER consumes AI credits. It only advises.

The service supports:
- UI/UX and landing pages
- Pitch decks and rebrands
- Social graphics and brand assets
- Motion design, explainers, reels, and editing
- Webflow and Framer work (each page counts as a task)

The service does NOT support as a single task:
- 3D, CAD
- Long-form editorial (e.g., books, 100-page reports)
- Complex packaging that requires structural design
- Development-heavy builds that cannot reasonably fit inside the standard SLA window for this plan
- Legal, medical, or highly regulated content requiring expert review

Task brief:
Title: ${title}
Description: ${description}
Structured Brief (if available):
${structuredBriefText}
Tags: ${tags?.join(', ') || 'None'}
Category: ${category || 'Unspecified'}
Brand: ${brandName ?? 'None'}
Brand context: ${brandSummary ?? 'None'}

Important guidelines:
- You are estimating two related concepts:
  - estimated_effort_hours: how much focused work this task likely is.
  - fits_48h_window: whether this task can reasonably fit inside a single standard ${standardSlaHours} hour SLA cycle.

- estimated_effort_hours must be in the 8 to 80 hour range.
  - Simple tasks are usually 8 to 24 hours.
  - Complex tasks are usually 25 to 80 hours.

- complexity:
  - "simple" if the work is reasonably scoped, straightforward and likely to fit in a single standard SLA cycle.
  - "complex" if the work is multi-step or heavy but still realistic for the service if split correctly.
  - "unsupported" if it is clearly outside the service model or in an unsupported category.

- fits_48h_window:
  - true if a single task could reasonably be delivered within the standard SLA target hours (${standardSlaHours}) without breaking the model.
  - false if the work clearly needs more than that as a single unit.

- display_sla_hours:
  - This is your best guess of a realistic delivery expectation in hours for this specific task on this plan, BUT:
  - It must never be less than 24.
  - It must never be greater than ${standardSlaHours}.
  - The backend will clamp it to [24, ${standardSlaHours}], so stay inside that band.

- recommended_split_count:
  - 1 if this can stay as one task.
  - >1 if the task should be split into multiple smaller tasks to stay realistic within the SLA.

- suggested_subtasks:
  - A list of concrete subtasks that the client could use to split the work if needed.

- missing_info_questions:
  - Ask 2–5 sharp questions that would help make the brief more complete.
  - These will be shown back to the client so they can improve the task before submission.

- ai_help_recommended:
  - true if the task is a good candidate for AI-assisted workflows (e.g., using Firefly, Midjourney, Runway, etc.).
  - false otherwise.
  - This does NOT affect the user's AI credits by itself. You are only advising.

- is_ai_supported:
  - true if AI tooling can realistically help.
  - false if the task is too subjective, sensitive, or outside typical AI capabilities.

- unsupported_reason:
  - Provide a clear explanation if complexity is "unsupported" OR is_ai_supported is false.

- flag_for_admin_review:
  - true if this task should be reviewed by an operator before starting (too big, too ambiguous, unsupported scope, or sensitive domain).
  - false otherwise.
  - Provide a short flag_reason when true.

Respond with VALID JSON only, no markdown, no commentary, exactly in this shape:
{
  "estimated_effort_hours": number,
  "display_sla_hours": number,
  "complexity": "simple" | "complex" | "unsupported",
  "complexity_score": number,
  "is_ai_supported": boolean,
  "unsupported_reason": string | null,
  "fits_48h_window": boolean,
  "flag_for_admin_review": boolean,
  "flag_reason": string | null,
  "recommended_split_count": number,
  "suggested_subtasks": string[],
  "missing_info_questions": string[],
  "ai_help_recommended": boolean,
  "ai_help_reason": string,
  "reasoning": string
}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

