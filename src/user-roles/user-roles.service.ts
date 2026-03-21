import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { Role } from 'src/common/enums/role.enum';

@Injectable()
export class UserRolesService {
  constructor(private prisma: PrismaService) {}

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
      return await this.prisma.userRole.create({
        data: {
          userId: dto.userId,
          roleId: dto.roleId,
        },
      });
    } catch (err) {
      // Prisma unique constraint violation (composite PK)
      throw new ConflictException('User already has this role');
    }
  }

  // ✅ Remove Role
  async removeRole(dto: RemoveRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    // 🚨 Prevent removing Admin role (optional but recommended)
    if (role.type === Role.Admin) {
      throw new ForbiddenException('Cannot remove admin role');
    }

    return this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: dto.userId,
          roleId: dto.roleId,
        },
      },
    });
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
