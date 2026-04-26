import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma.service';

import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { jwtConstants } from '../constants';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<Request>();

    try {
      const payload = await this.verifyToken(request);

      this.validatePayload(payload);
      await this.validateTokenVersion(payload);

      (request as any).user = payload;

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid or expired token';
      throw new UnauthorizedException(message);
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
      secret: jwtConstants.accessSecret,
    });
  }

  private validatePayload(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token: missing user id');
    }

    if (!Array.isArray(payload.roles)) {
      throw new UnauthorizedException('Invalid token: roles missing');
    }

    if (!Array.isArray(payload.permissions)) {
      throw new UnauthorizedException('Invalid token: permissions missing');
    }

    if (typeof payload.tokenVersion !== 'number') {
      throw new UnauthorizedException('Invalid token: token version missing');
    }
  }

  private async validateTokenVersion(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }
  }
}
