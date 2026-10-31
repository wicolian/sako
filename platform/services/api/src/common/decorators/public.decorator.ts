import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or route as publicly accessible (no auth required)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
