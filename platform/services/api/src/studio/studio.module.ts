import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioAiController } from './studio-ai.controller';
import { StudioService } from './studio.service';
import { StudioTaskCommentsController } from './studio-comments.controller';
import { StudioFromComposerController } from './studio-from-composer.controller';
import { TaskModule } from '../task/task.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [TaskModule, SlackModule],
  controllers: [StudioController, StudioAiController, StudioTaskCommentsController, StudioFromComposerController],
  providers: [StudioService],
})
export class StudioModule { }
