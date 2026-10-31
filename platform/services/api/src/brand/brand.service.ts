import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionPausedException, SubscriptionCanceledException } from '../common/exceptions/business.exceptions';

@Injectable()
export class BrandService {
  constructor(
    private prisma: PrismaService,
    private workspaceService: WorkspaceService,
  ) {}

  /**
   * List all brands for workspace
   */
  async listBrands(workspaceId: string) {
    return this.prisma.brand.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get brand by ID (scoped to workspace)
   */
  async getBrand(workspaceId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        workspaceId,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand not found: ${brandId}`);
    }

    return brand;
  }

  /**
   * Create brand
   * Rule: reject if subscription is PAUSED or CANCELED
   */
  async createBrand(workspaceId: string, dto: CreateBrandDto) {
    // Check subscription status
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);
    
    if (workspace.subscription?.status === SubscriptionStatus.PAUSED) {
      throw new SubscriptionPausedException(workspaceId);
    }
    
    if (workspace.subscription?.status === SubscriptionStatus.CANCELED) {
      throw new SubscriptionCanceledException(workspaceId);
    }

    return this.prisma.brand.create({
      data: {
        workspaceId,
        name: dto.name,
        // Direct color fields
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        accentColor: dto.accentColor,
        // Extended JSON fields (cast to any for Prisma JSON compatibility)
        colorsJson: dto.colorsJson as any,
        typographyJson: dto.typographyJson as any,
        brandProfileJson: dto.brandProfileJson as any,
        // Tone and voice
        toneTags: dto.toneTags || [],
        voiceGuidelines: dto.voiceGuidelines,
        guidelines: dto.guidelines,
        // Asset URLs
        logoUrl: dto.logoUrl,
        guidelineUrl: dto.guidelineUrl,
      },
    });
  }

  /**
   * Update brand (scoped to workspace)
   */
  async updateBrand(workspaceId: string, brandId: string, dto: UpdateBrandDto) {
    // Verify brand exists and belongs to workspace
    await this.getBrand(workspaceId, brandId);

    // Build update data, only including defined fields
    const updateData: any = {};
    
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.primaryColor !== undefined) updateData.primaryColor = dto.primaryColor;
    if (dto.secondaryColor !== undefined) updateData.secondaryColor = dto.secondaryColor;
    if (dto.accentColor !== undefined) updateData.accentColor = dto.accentColor;
    if (dto.colorsJson !== undefined) updateData.colorsJson = dto.colorsJson;
    if (dto.typographyJson !== undefined) updateData.typographyJson = dto.typographyJson;
    if (dto.brandProfileJson !== undefined) updateData.brandProfileJson = dto.brandProfileJson;
    if (dto.toneTags !== undefined) updateData.toneTags = dto.toneTags;
    if (dto.voiceGuidelines !== undefined) updateData.voiceGuidelines = dto.voiceGuidelines;
    if (dto.guidelines !== undefined) updateData.guidelines = dto.guidelines;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.guidelineUrl !== undefined) updateData.guidelineUrl = dto.guidelineUrl;

    return this.prisma.brand.update({
      where: { id: brandId },
      data: updateData,
    });
  }

  /**
   * Delete brand (scoped to workspace)
   */
  async deleteBrand(workspaceId: string, brandId: string) {
    // Verify brand exists and belongs to workspace
    await this.getBrand(workspaceId, brandId);

    return this.prisma.brand.delete({
      where: { id: brandId },
    });
  }
}

