import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateUserDto,
  publicUserSelect,
  UserResponseDto,
} from './dto/createUser.dto';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { ChangePasswordDto } from './dto/updateProfile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.create({
      data: {
        full_name: createUserDto.full_name,
        email: createUserDto.email,
        password: createUserDto.password, // already hashed in AuthService
        phone: createUserDto.phone,
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

    return user as UserResponseDto;
  }

  async findUserByEmailWithRoles(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // ---------------- PROFILE ----------------

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { bookings: true },
        },
        userRoles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      totalBookings: user._count.bookings,
      roles: user.userRoles.map((userRole) => userRole.role.name),
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: updateProfileDto.full_name,
        phone: updateProfileDto.phone,
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { bookings: true },
        },
        userRoles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      totalBookings: user._count.bookings,
      roles: user.userRoles.map((userRole) => userRole.role.name),
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const passwordMatch = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return { message: 'Password updated successfully' };
  }
}
