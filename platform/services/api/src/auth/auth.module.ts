import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn =
          (config.get('JWT_EXPIRES_IN') as JwtSignOptions['expiresIn']) ||
          '7d';
        return {
          secret: config.get<string>('JWT_SECRET') || 'sako-dev-secret',
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthMiddleware, ThrottlerGuard],
  exports: [JwtModule, AuthMiddleware],
})
export class AuthModule {}

