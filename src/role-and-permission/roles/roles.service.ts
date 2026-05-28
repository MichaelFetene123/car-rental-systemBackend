import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateRoleDto } from '../dto/createRole.dto';
import { UpdateRoleDto } from '../dto/updateRole.dto';
import { Role } from '../../common/enums/role.enum';

const DEFAULT_ROLE_NAMES = new Set(['admin', 'stuff', 'user']);

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async getAllRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        userRoles: true,
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      userCount: r.userRoles.length,
      permissions: r.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async createRole(dto: CreateRoleDto) {
    if (dto.type === Role.User) {
      throw new ForbiddenException(
        'Cannot create roles with user type. User is a system-only role.',
      );
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        type: dto.type,
        rolePermissions: {
          create: dto.permissionIds.map((id) => ({
            permissionId: id,
          })),
        },
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException();

    const roleName = role.name.trim().toLowerCase();
    if (roleName === 'user') {
      throw new ForbiddenException('Cannot modify the default user role.');
    }

    if (dto.type === Role.User) {
      throw new ForbiddenException('Cannot change role type to user.');
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        rolePermissions: dto.permissionIds
          ? {
              deleteMany: { roleId: id },
              create: dto.permissionIds.map((id) => ({
                permissionId: id,
              })),
            }
          : undefined,
      },
    });

    // Bump tokenVersion for all users with this role so they refresh permissions immediately
    if (dto.permissionIds) {
      await this.prisma.user.updateMany({
        where: {
          userRoles: {
            some: { roleId: id },
          },
        },
        data: {
          tokenVersion: { increment: 1 },
        },
      });
    }

    return updatedRole;
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException();

    const roleName = role.name.trim().toLowerCase();
    if (DEFAULT_ROLE_NAMES.has(roleName)) {
      throw new ForbiddenException('Default system roles cannot be deleted.');
    }

    return this.prisma.role.delete({ where: { id } });
  }
}

