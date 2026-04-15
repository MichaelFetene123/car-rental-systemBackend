import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { Role } from '../common/enums/role.enum';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserRolesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  // ✅ Assign Role
  async assignRole(dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    try {
      await this.prisma.userRole.create({
        data: {
          userId: dto.userId,
          roleId: dto.roleId,
        },
      });
    } catch {
      throw new ConflictException('User already has this role');
    }

    // ✅ IMPORTANT: return new token
    return this.authService.generateUserToken(dto.userId);
  }

  // ✅ Remove Role
  async removeRole(dto: RemoveRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    if (role.type === Role.Admin) {
      throw new ForbiddenException('Cannot remove admin role');
    }

    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: dto.userId,
          roleId: dto.roleId,
        },
      },
    });

    // ✅ return refreshed token
    return this.authService.generateUserToken(dto.userId);
  }

  // ✅ Get all roles of a user
  async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      type: ur.role.type,
      permissions: ur.role.rolePermissions.map((rp) => rp.permission.code),
    }));
  }
}
