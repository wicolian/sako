import { JwtAuthGuard } from '../src/auth/guards/auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';

const createContext = (request: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('allows public routes even without auth', () => {
    const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('blocks protected routes without a valid user', () => {
    const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtAuthGuard(reflector);

    expect(() => guard.canActivate(createContext({}))).toThrow(UnauthorizedException);
  });

  it('allows protected routes when user is attached to the request', () => {
    const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtAuthGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ user: { sub: 'user_1', workspaceId: 'ws_1' } })),
    ).not.toThrow();
  });
});
