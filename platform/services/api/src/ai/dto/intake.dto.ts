import { IsString, IsOptional, IsArray } from 'class-validator';

export class IntakeRequestDto {
    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    brandId?: string;

    @IsOptional()
    @IsString()
    context?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    referenceLinks?: string[];
}

export class IntakeResponseDto {
    goal: string;
    audience: string;
    funnelStage: "top" | "middle" | "bottom" | "unknown";
    primaryAssetType: "landing_page" | "social" | "email" | "deck" | "video" | "other";
    keyMessage: string;
    tone?: string;
    sections?: string[];
    deliverables: string[];
    missingInfoQuestions: string[];
}
