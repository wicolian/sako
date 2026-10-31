/**
 * Sako Client - Public API
 * 
 * Re-exports the main functions from task-manager for external use.
 * This is the main entry point for Sako integration.
 */

export {
  createSakoTask,
  getTaskStatus,
  getTasksForCampaign,
  getTasksForWorkspace,
  cancelTask,
  transitionTaskStatus,
  handleSakoWebhook,
  checkSakoConnection,
  getEstimatedDelivery,
  type SakoTask,
  type CreateTaskRequest,
  type TaskWebhookPayload,
  type TransitionTaskStatusRequest,
  type TaskType,
  type TaskStatus,
  type TaskPriority,
} from './task-manager';

// Additional type for campaign data used in escalation
export interface CampaignData {
  id: string;
  name: string;
  audience?: string;
  goal?: string;
  offer?: string;
  cta?: string;
  angles?: Array<{
    name: string;
    description: string;
    trustScore?: number;
  }>;
  pageBlocks?: Array<{
    type: string;
    props: Record<string, unknown>;
  }>;
  messages?: Array<{
    type: string;
    text: string;
  }>;
}
