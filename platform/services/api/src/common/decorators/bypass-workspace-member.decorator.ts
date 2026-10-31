import { SetMetadata } from '@nestjs/common';

export const BYPASS_WORKSPACE_MEMBER_KEY = 'bypassWorkspaceMember';
export const BypassWorkspaceMember = () => SetMetadata(BYPASS_WORKSPACE_MEMBER_KEY, true);
