import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { BrandService } from './brand.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@ApiTags('Brands')
@ApiBearerAuth('bearer')
@ApiSecurity('workspace-header')
@UseGuards(ClerkAuthGuard, WorkspaceMemberGuard, SubscriptionGuard)
@Controller('brands')
export class BrandController {
  constructor(private brandService: BrandService) { }

  @Get()
  @ApiOperation({ summary: 'List brands for workspace' })
  async listBrands(@WorkspaceId() workspaceId: string) {
    return this.brandService.listBrands(workspaceId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create brand',
    description: 'Creates a new brand. Rejects if subscription is PAUSED or CANCELED.',
  })
  async createBrand(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateBrandDto,
  ) {
    return this.brandService.createBrand(workspaceId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  async getBrand(
    @WorkspaceId() workspaceId: string,
    @Param('id') brandId: string,
  ) {
    return this.brandService.getBrand(workspaceId, brandId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update brand' })
  async updateBrand(
    @WorkspaceId() workspaceId: string,
    @Param('id') brandId: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brandService.updateBrand(workspaceId, brandId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete brand' })
  async deleteBrand(
    @WorkspaceId() workspaceId: string,
    @Param('id') brandId: string,
  ) {
    return this.brandService.deleteBrand(workspaceId, brandId);
  }
}
