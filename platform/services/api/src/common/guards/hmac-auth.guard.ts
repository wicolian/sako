import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * HMAC Authentication Guard
 *
 * Verifies HMAC-signed requests from the Composer backend.
 * Used for internal machine-to-machine API calls.
 *
 * Required headers:
 * - X-Composer-Signature: HMAC-SHA256 signature of the payload
 * - X-Composer-Timestamp: Unix timestamp (ms) for replay protection
 *
 * The payload is constructed from the request body (POST) or query params (GET).
 */
@Injectable()
export class HmacAuthGuard implements CanActivate {
  private readonly logger = new Logger(HmacAuthGuard.name);
  private readonly MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const signature = request.headers['x-composer-signature'];
    const timestampStr = request.headers['x-composer-timestamp'];

    if (!signature || !timestampStr) {
      this.logger.warn('HMAC auth failed: missing signature or timestamp header');
      throw new UnauthorizedException({
        error: 'MISSING_AUTH_HEADERS',
        message: 'Missing X-Composer-Signature or X-Composer-Timestamp header',
      });
    }

    const hmacSecret = this.configService.get<string>('COMPOSER_HMAC_SECRET');
    if (!hmacSecret) {
      this.logger.error('COMPOSER_HMAC_SECRET not configured');
      throw new UnauthorizedException({
        error: 'HMAC_NOT_CONFIGURED',
        message: 'HMAC authentication not configured',
      });
    }

    // Validate timestamp to prevent replay attacks
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw new UnauthorizedException({
        error: 'INVALID_TIMESTAMP',
        message: 'X-Composer-Timestamp must be a valid unix timestamp',
      });
    }

    const age = Date.now() - timestamp;
    if (age > this.MAX_AGE_MS) {
      this.logger.warn(`HMAC auth failed: request expired (age: ${age}ms)`);
      throw new UnauthorizedException({
        error: 'REQUEST_EXPIRED',
        message: 'Request has expired. Please retry.',
      });
    }

    // Build payload for signature verification
    // For GET requests, use workspaceId from params + timestamp
    // For POST requests, use the body
    let payload: string;
    if (request.method === 'GET') {
      const workspaceId = request.params.workspaceId || request.query.workspaceId;
      payload = JSON.stringify({ workspaceId, timestamp });
    } else {
      payload = JSON.stringify({ ...request.body, timestamp });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', hmacSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn('HMAC auth failed: invalid signature');
      throw new UnauthorizedException({
        error: 'INVALID_SIGNATURE',
        message: 'Invalid request signature',
      });
    }

    this.logger.debug('HMAC auth successful');
    return true;
  }
}
