import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiIntakeService } from './ai-intake.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [AiService, AiIntakeService],
  exports: [AiService, AiIntakeService],
})
export class AiModule { }
