import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService, SearchResult } from './search.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { Roles } from '../common/decorators/roles.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @BypassWorkspaceMember() // Search doesn't require a specific workspace
  @BypassSubscription() // Search doesn't require active subscription
  @ApiOperation({ summary: 'Global search across tasks and workspaces' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query (min 2 characters)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['client', 'studio'], description: 'Search scope' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results per category (default: 10)' })
  async search(
    @Query('q') query: string,
    @Query('scope') scope: 'client' | 'studio' = 'client',
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    // Validate scope permissions
    if (scope === 'studio') {
      // Only ADMIN can use studio scope
      if (user.role !== 'ADMIN') {
        throw new BadRequestException('Studio search scope requires ADMIN role');
      }
    }

    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;

    return this.searchService.search(
      query,
      scope,
      user.id,
      parsedLimit,
    );
  }
}

