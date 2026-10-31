import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { buildPlanDefinitions } from '../billing/plan.config';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) { }

    @Public()
    @Get()
    async check() {
        const checks: Record<string, 'ok' | 'error'> = {
            db: 'ok',
            plans: 'ok',
            stripeEnv: 'ok',
        };
        let status: 'ok' | 'error' = 'ok';

        // 1. DB Check
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch (e) {
            checks.db = 'error';
            status = 'error';
        }

        // 2. Plans Check
        try {
            const count = await this.prisma.plan.count();
            if (count === 0) {
                checks.plans = 'error';
                status = 'error';
            }
        } catch (e) {
            checks.plans = 'error';
            status = 'error';
        }

        // 3. Stripe Env Check
        // We check if any plan has a missing stripePriceId (which means env var missing in prod)
        const planDefinitions = buildPlanDefinitions(this.configService);
        const missingEnvs = Object.values(planDefinitions).some((p) => !p.stripePriceId);
        if (missingEnvs) {
            checks.stripeEnv = 'error';
            status = 'error';
        }

        if (status === 'error') {
            throw new ServiceUnavailableException({ status, checks });
        }

        return { status, checks };
    }
}
