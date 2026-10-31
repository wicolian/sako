import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject, MaxLength, IsUrl } from 'class-validator';

// Type definitions for structured brand data
export interface BrandColorsJson {
  primary?: string;
  secondary?: string;
  accent?: string;
  gradients?: Array<{ from: string; to: string; direction?: string }>;
  neutrals?: string[];
  backgrounds?: string[];
}

export interface BrandTypographyJson {
  headingFont?: string;
  bodyFont?: string;
  scale?: 'small' | 'medium' | 'large';
  weights?: number[];
  headingSizes?: { h1?: string; h2?: string; h3?: string; h4?: string };
}

export interface BrandProfileJson {
  heroStyle?: 'centered' | 'split' | 'fullwidth' | 'minimal';
  gridPreferences?: 'standard' | 'asymmetric' | 'masonry';
  ctaStyle?: 'solid' | 'outline' | 'gradient' | 'minimal';
  imageStyle?: 'rounded' | 'sharp' | 'circular';
  spacing?: 'tight' | 'normal' | 'spacious';
  layoutNotes?: string;
}

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand name' })
  @IsString()
  @MaxLength(100)
  name: string;

  // Direct color fields
  @ApiPropertyOptional({ description: 'Primary brand color (hex)' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color (hex)' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Accent brand color (hex)' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  // Extended JSON fields
  @ApiPropertyOptional({ description: 'Extended color palette with gradients and neutrals' })
  @IsOptional()
  @IsObject()
  colorsJson?: BrandColorsJson;

  @ApiPropertyOptional({ description: 'Typography settings (fonts, scale, weights)' })
  @IsOptional()
  @IsObject()
  typographyJson?: BrandTypographyJson;

  @ApiPropertyOptional({ description: 'Brand profile / layout preferences for Composer' })
  @IsOptional()
  @IsObject()
  brandProfileJson?: BrandProfileJson;

  @ApiPropertyOptional({ description: 'Tone tags (e.g., playful, serious)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toneTags?: string[];

  @ApiPropertyOptional({ description: 'Detailed voice/tone guidelines for AI generation' })
  @IsOptional()
  @IsString()
  voiceGuidelines?: string;

  @ApiPropertyOptional({ description: 'General brand guidelines text' })
  @IsOptional()
  @IsString()
  guidelines?: string;

  // Asset URLs
  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Brand guidelines document URL' })
  @IsOptional()
  @IsString()
  guidelineUrl?: string;
}

export class UpdateBrandDto {
  @ApiPropertyOptional({ description: 'Brand name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // Direct color fields
  @ApiPropertyOptional({ description: 'Primary brand color (hex)' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color (hex)' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Accent brand color (hex)' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  // Extended JSON fields
  @ApiPropertyOptional({ description: 'Extended color palette with gradients and neutrals' })
  @IsOptional()
  @IsObject()
  colorsJson?: BrandColorsJson;

  @ApiPropertyOptional({ description: 'Typography settings (fonts, scale, weights)' })
  @IsOptional()
  @IsObject()
  typographyJson?: BrandTypographyJson;

  @ApiPropertyOptional({ description: 'Brand profile / layout preferences for Composer' })
  @IsOptional()
  @IsObject()
  brandProfileJson?: BrandProfileJson;

  @ApiPropertyOptional({ description: 'Tone tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toneTags?: string[];

  @ApiPropertyOptional({ description: 'Detailed voice/tone guidelines for AI generation' })
  @IsOptional()
  @IsString()
  voiceGuidelines?: string;

  @ApiPropertyOptional({ description: 'General brand guidelines text' })
  @IsOptional()
  @IsString()
  guidelines?: string;

  // Asset URLs
  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Brand guidelines document URL' })
  @IsOptional()
  @IsString()
  guidelineUrl?: string;
}

