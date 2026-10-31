import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, IsNotEmpty, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { BillingInterval, getAllPlanCodes, PlanCode } from '../../billing/plan.config';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Plan code (CORE, OPS, or ENTERPRISE). CORE supports both Design + Motion.',
    example: 'CORE',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(getAllPlanCodes())
  planCode: PlanCode;

  @ApiProperty({
    description: 'Billing interval for the subscription',
    example: 'MONTHLY',
    enum: [BillingInterval.MONTHLY, BillingInterval.YEARLY],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([BillingInterval.MONTHLY, BillingInterval.YEARLY])
  billingInterval: BillingInterval;

  @ApiPropertyOptional({
    description: 'Use embedded checkout mode (displays in iframe instead of redirect)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  embedded?: boolean;

  @ApiPropertyOptional({
    description: 'URL to redirect to after successful checkout (required when embedded=false)',
    example: 'https://app.sako.com/success',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect to if checkout is canceled (required when embedded=false)',
    example: 'https://app.sako.com/cancel',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;

  @ApiPropertyOptional({
    description: 'URL to return to after embedded checkout completes (required when embedded=true)',
    example: 'https://app.sako.com/billing/success',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;
}

/**
 * DTO for Composer Pro checkout (simplified - only supports COMPOSER_PRO)
 */
export class CreateComposerCheckoutDto {
  @ApiProperty({
    description: 'Billing interval for the subscription',
    example: 'MONTHLY',
    enum: [BillingInterval.MONTHLY, BillingInterval.YEARLY],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([BillingInterval.MONTHLY, BillingInterval.YEARLY])
  billingInterval: BillingInterval;

  @ApiProperty({
    description: 'URL to redirect to after successful checkout',
    example: 'https://composer.trysako.com/#/success',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  successUrl: string;

  @ApiProperty({
    description: 'URL to redirect to if checkout is canceled',
    example: 'https://composer.trysako.com/#/cancel',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  cancelUrl: string;

  @ApiPropertyOptional({
    description: 'Optional workspace name to create if user has none',
    example: 'My Workspace',
  })
  @IsOptional()
  @IsString()
  workspaceName?: string;
}
