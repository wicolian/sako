import { ConfigService } from '@nestjs/config';

export interface AuthUser {
    id: string;
    clerkUserId: string;
    email: string;
    name?: string;
    role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
    isSuperAdmin: boolean;
}

export class ClerkConfig {
    constructor(private readonly configService: ConfigService) { }

    get publishableKey(): string {
        return this.configService.getOrThrow<string>('CLERK_PUBLISHABLE_KEY');
    }

    get secretKey(): string {
        return this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
    }

    get jwtIssuer(): string {
        // Default Clerk issuer format, can be overridden
        return this.configService.get<string>('CLERK_JWT_ISSUER') || `https://clerk.${this.getDomain()}`;
    }

    get allowedStudioDomains(): string[] {
        const domains = this.configService.get<string>('ALLOWED_STUDIO_DOMAINS');
        return domains ? domains.split(',').map(d => d.trim()) : ['trysako.com', 'sako.design', 'sako.agency'];
    }

    private getDomain(): string {
        const key = this.publishableKey;
        // Extract domain from publishable key if possible
        //pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXY$
        return 'clerk.accounts.dev';
    }

    isStudioEmail(email: string): boolean {
        const emailDomain = email.split('@')[1]?.toLowerCase();
        return this.allowedStudioDomains.some(domain => domain.toLowerCase() === emailDomain);
    }
}
