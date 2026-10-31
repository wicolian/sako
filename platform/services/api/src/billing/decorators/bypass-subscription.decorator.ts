import { SetMetadata } from '@nestjs/common';

export const BYPASS_SUBSCRIPTION_KEY = 'bypassSubscription';
export const BypassSubscription = () => SetMetadata(BYPASS_SUBSCRIPTION_KEY, true);
