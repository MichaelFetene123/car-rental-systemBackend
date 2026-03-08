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
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    try {
      // Extract and verify the JWT from the request header
      const payload = await this.verifyToken(request);
      request['user'] = payload; // Attach the user to the request
    } catch (error) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private async verifyToken(request: Request): Promise<any> {
    const authHeader = request.headers.authorization || '';
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    // Verify the token using the JwtService and return the payload
    const payload = await this.jwtService.verifyAsync(token, {
      secret: jwtConstants.secret,
    });
    return payload;
  }
}
