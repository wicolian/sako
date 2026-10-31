import { Controller, Post, Body } from '@nestjs/common';
import { AiIntakeService } from './ai-intake.service';
import { IntakeRequestDto } from './dto/intake.dto';
import { WorkspaceId } from '../common/decorators/workspace.decorator';

@Controller('ai')
export class AiController {
    constructor(private readonly aiIntakeService: AiIntakeService) { }

    @Post('intake')
    async intake(
        @WorkspaceId() workspaceId: string,
        @Body() dto: IntakeRequestDto,
    ) {
        return this.aiIntakeService.intake(workspaceId, dto);
    }
}
