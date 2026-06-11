import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma.service';
import { AuthService } from '../../auth/auth.service';
import { UpdateUserDto } from '../dto/updateUser.dto';
import {
  CreateUserDto,
  publicUserSelect,
  UserResponseDto,
} from '../dto/createUser.dto';
import * as bcrypt from 'bcrypt';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        userRoles: {
          none: {
            role: {
              name: Role.Admin,
            },
          },
        },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        updated_at: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      totalBookings: user._count.bookings,
      roles: user.userRoles.map((userRole) => userRole.role.name),
    }));
  }

  async createUserByAdmin(
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const createUser = await this.prisma.user.create({
      data: {
        full_name: createUserDto.full_name,
        email: createUserDto.email,
        password: hashedPassword,
        phone: createUserDto.phone,
        status: createUserDto.status ?? 'active',
        last_active_at: new Date(),
        userRoles: {
          create: {
            role: {
              connect: { name: 'user' },
            },
          },
        },
      },
      select: publicUserSelect,
    });

    return createUser;
  }

  async updateUserByAdmin(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    let password: string | undefined;

    if (updateUserDto.password) {
      password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: updateUserDto.full_name,
        email: updateUserDto.email,
        phone: updateUserDto.phone,
        status: updateUserDto.status,
        ...(password && { password }),
      },
    });
  }

  async deleteUserByAdmin(userid: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userid },
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user._count.bookings > 0) {
      throw new HttpException(
        `This user has ${user._count.bookings} booking${user._count.bookings > 1 ? 's' : ''} and can't be deleted`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.user.delete({
      where: { id: userid },
    });

    return { message: 'user deleted successfully' };
  }

  async assignRoles(userId: string, roles: Role[]) {
    if (roles.includes(Role.Admin)) {
      throw new ForbiddenException('Admin role assignment is not allowed');
    }
    // Delete existing roles for the user
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // Find role records in the database
    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roles } },
    });

    // Safety check: ensure all requested roles exist
    if (roleRecords.length !== roles.length) {
      throw new NotFoundException('One or more roles do not exist');
    }

    // Create new user-role associations
    await this.prisma.userRole.createMany({
      data: roleRecords.map((r) => ({
        userId,
        roleId: r.id,
      })),
      skipDuplicates: true,
    });

    // Bump tokenVersion to invalidate old tokens, then generate a new access token
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    return this.authService.generateUserToken(userId);
  }
}
