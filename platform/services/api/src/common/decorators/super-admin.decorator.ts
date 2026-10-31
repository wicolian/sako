import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SuperAdminGuard } from '../guards/super-admin.guard';

export function SuperAdmin() {
  return applyDecorators(
    UseGuards(SuperAdminGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized - Super Admin required' }),
  );
}

