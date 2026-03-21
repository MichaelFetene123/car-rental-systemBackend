import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { jwtConstants } from '../constants';

type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ✅ Allow public routes
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<Request>();

    try {
      const payload = await this.verifyToken(request);

      // ✅ Validate payload structure (CRITICAL)
      this.validatePayload(payload);

      // ✅ Attach user to request (typed)
      (request as any).user = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        error?.message || 'Invalid or expired token',
      );
    }
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private async verifyToken(request: Request): Promise<JwtPayload> {
    const authHeader = request.headers.authorization || '';
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: jwtConstants.secret,
    });
  }

  // 🔥 CRITICAL VALIDATION
  private validatePayload(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token: missing user id');
    }

    if (!Array.isArray(payload.roles)) {
      throw new UnauthorizedException('Invalid token: roles missing');
    }

    if (!Array.isArray(payload.permissions)) {
      throw new UnauthorizedException('Invalid token: permissions missing');
    }
  }
}
