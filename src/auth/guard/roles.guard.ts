import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma.service';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { RoleType } from 'src/generated/prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) return false;

    // 🔥 FETCH USER ROLES FROM DB (CORRECT FOR YOUR SCHEMA)
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roleTypes = userRoles.map((ur) => ur.role.type);

    return requiredRoles.some((role) => roleTypes.includes(role));
  }
}
