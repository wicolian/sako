import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured. AI estimator will use a deterministic fallback response instead of calling OpenAI.',
      );
    }
  }

  /**
   * Calls OpenAI API to estimate a task based on a prompt.
   * Returns the raw JSON string response from the model.
   */
  async estimateTask(prompt: string): Promise<string> {
    // If no API key is configured, return a deterministic fallback response
    if (!this.apiKey) {
      this.logger.debug('Using fallback AI estimator response (no OPENAI_API_KEY configured).');

      const fallback = {
        estimated_effort_hours: 24,
        display_sla_hours: 48,
        complexity: 'simple',
        complexity_score: 4,
        is_ai_supported: true,
        unsupported_reason: null,
        fits_48h_window: true,
        flag_for_admin_review: false,
        flag_reason: null,
        recommended_split_count: 1,
        suggested_subtasks: [],
        missing_info_questions: [],
        ai_help_recommended: false,
        ai_help_reason: 'Standard task within 48-hour SLA window; AI assistance optional.',
        reasoning:
          'Fallback estimate used because OPENAI_API_KEY is not configured. This represents a typical single-cycle task that fits within the standard SLA window.',
      };

      return JSON.stringify(fallback);
    }

    return this.callOpenAi(
      prompt,
      'You are an AI task estimator for SAKO, a design and motion subscription service. You always respond with valid JSON only, no markdown, no commentary.'
    );
  }

  async chat(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.debug('Using fallback AI response (no OPENAI_API_KEY configured).');
      return JSON.stringify({ error: "No API key configured" });
    }
    return this.callOpenAi(prompt, systemPrompt);
  }

  private async callOpenAi(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`OpenAI API error: ${response.status} ${errorBody}`);
        throw new BadRequestException(`AI service returned error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new BadRequestException('AI service returned empty response');
      }

      return content;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to call OpenAI API', error);
      throw new BadRequestException('Failed to communicate with AI service');
    }
  }
}

