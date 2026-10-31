import { SetMetadata, applyDecorators } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'admin_only';

/**
 * Decorator to mark an endpoint as admin-only
 * Used in conjunction with AdminGuard
 */
export const AdminOnly = () => applyDecorators(SetMetadata(ADMIN_ONLY_KEY, true));

