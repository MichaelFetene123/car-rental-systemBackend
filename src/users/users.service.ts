import {
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
import { Role } from 'src/auth/enums/role.enum';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { ChangePasswordDto } from './dto/updateProfile.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/updateUser.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const createUser = await this.prisma.user.create({
      data: {
        full_name: createUserDto.full_name,
        email: createUserDto.email,
        password: createUserDto.password,
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

    return createUser;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: updateUserDto.full_name,
        email: updateUserDto.email,
      },
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async assignRoles(userId: string, roles: Role[]) {
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roles } },
    });

    await this.prisma.userRole.createMany({
      data: roleRecords.map((r) => ({
        userId,
        roleId: r.id,
      })),
      skipDuplicates: true,
    });

    return { message: 'Roles updated successfully' };
  }

  // ---------------- PROFILE ----------------

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
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
      throw new NotFoundException('User not found');
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
