import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ChangePlanDto {
    @ApiProperty({
        description: 'Target Plan Key (e.g. OPS_MONTHLY)',
        example: 'OPS_MONTHLY',
    })
    @IsString()
    @IsNotEmpty()
    targetPlanKey: string;
}
