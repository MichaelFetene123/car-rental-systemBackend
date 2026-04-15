import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateRoleDto } from '../dto/createRole.dto';
import { UpdateRoleDto } from '../dto/updateRole.dto';
import { Role } from '../../common/enums/role.enum';

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

    return this.prisma.role.update({
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
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException();

    if (role.type === Role.Admin) throw new ForbiddenException();

    return this.prisma.role.delete({ where: { id } });
  }
}

