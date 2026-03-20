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
  UserResponseDto,
  publicUserSelect,
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

    return user;
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
      select: publicUserSelect,
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: updateProfileDto.full_name,
        phone: updateProfileDto.phone,
      },
      select: publicUserSelect,
    });
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
