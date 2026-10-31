import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { WorkspaceRole } from '@prisma/client';

interface TokenPayload {
  sub: string;
  workspaceId?: string;
  workspaceSlug?: string;
  role?: WorkspaceRole;
  email?: string;
  isSuperAdmin?: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request & { user?: TokenPayload; workspaceFromToken?: string }, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const payload = this.jwtService.verify<TokenPayload>(token);
          req.user = payload;
          if (payload.workspaceId) {
            req.workspaceFromToken = payload.workspaceId;
          }
        } catch {
          // Ignore invalid/expired tokens; we still allow header fallback for now
        }
      }
    }

    next();
  }
}

