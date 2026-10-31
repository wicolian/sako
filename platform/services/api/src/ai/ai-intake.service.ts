import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { IntakeRequestDto, IntakeResponseDto } from './dto/intake.dto';

@Injectable()
export class AiIntakeService {
    private readonly logger = new Logger(AiIntakeService.name);

    constructor(
        private aiService: AiService,
        private prisma: PrismaService,
    ) { }

    async intake(workspaceId: string, dto: IntakeRequestDto): Promise<IntakeResponseDto> {
        let brandContext = '';
        if (dto.brandId) {
            const brand = await this.prisma.brand.findFirst({
                where: { id: dto.brandId, workspaceId },
            });
            if (brand) {
                brandContext = `Brand: ${brand.name}\nGuidelines: ${brand.guidelines || 'None'}\nTone: ${brand.toneTags.join(', ')}`;
            }
        }

        const prompt = `
Task Intake Request:
Title: ${dto.title || 'Untitled'}
Description: ${dto.description}
Context: ${dto.context || 'None'}
References: ${dto.referenceLinks?.join(', ') || 'None'}
${brandContext}

Extract a structured brief from this request.
Return JSON matching:
{
  "goal": string,
  "audience": string,
  "funnelStage": "top" | "middle" | "bottom" | "unknown",
  "primaryAssetType": "landing_page" | "social" | "email" | "deck" | "video" | "other",
  "keyMessage": string,
  "tone": string,
  "sections": string[],
  "deliverables": string[],
  "missingInfoQuestions": string[]
}
`;

        const response = await this.aiService.chat(
            prompt,
            'You are an AI intake specialist. Convert the brief into structured JSON. Respond with valid JSON only.'
        );

        try {
            return JSON.parse(response) as IntakeResponseDto;
        } catch (e) {
            this.logger.error('Failed to parse intake response', e);
            // Return fallback
            return {
                goal: dto.description.substring(0, 50),
                audience: 'Unknown',
                funnelStage: 'unknown',
                primaryAssetType: 'other',
                keyMessage: 'Unknown',
                tone: 'Neutral',
                sections: [],
                deliverables: [],
                missingInfoQuestions: ['Could not parse AI response'],
            };
        }
    }
}
