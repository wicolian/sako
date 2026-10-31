import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ComposerService {
  private readonly logger = new Logger(ComposerService.name);

  /**
   * Check if Composer generation is available (LLM providers configured)
   * Used by ComposerGatewayController to inform external Composer app
   */
  isGenerationAvailable(): boolean {
    // Generation is handled by the external Sako Composer app in this setup.
    // The monolith only exposes gateway endpoints for workspace/brand context
    // and \"Send to Sako\" task creation.
    this.logger.debug('Composer generation is disabled in this deployment (external Composer handles generation).');
    return false;
  }
}
