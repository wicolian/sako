import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { WorkspaceRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface AuthPayload {
  sub: string;
  workspaceId: string;
  workspaceSlug: string;
  role: WorkspaceRole;
  email: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private isInternalAdminEmail(email: string): boolean {
    const adminEmails = this.configService.get<string>('INTERNAL_ADMIN_EMAILS')?.split(',') || [];
    return adminEmails.some(adminEmail => email === adminEmail.trim().toLowerCase());
  }

  async login(dto: LoginDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: dto.workspaceSlug.trim().toLowerCase() },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(
        `Workspace "${dto.workspaceSlug}" not found`,
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: dto.name?.trim() || null,
          isSuperAdmin: this.isInternalAdminEmail(normalizedEmail),
        },
      });
    } else if (dto.name && !user.name) {
      // Fill name the first time we get it
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.name.trim() },
      });
    }


    const membership = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: WorkspaceRole.OWNER,
      },
    });

    const payload: AuthPayload = {
      sub: user.id,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      role: membership.role,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      membership: {
        role: membership.role,
      },
    };
  }
}


