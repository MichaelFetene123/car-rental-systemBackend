import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma.service';
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
} from '@nestjs/common';

@Injectable()
export class AdminUsersService {
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
        ...(password && { password }),
      },
    });
  }

  async deleteUserByAdmin(userid: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userid },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.user.delete({
      where: { id: userid },
    });

    return { message: 'user deleted successfully' };
  }

  async assignRoles(userId: string, roles: Role[]) {
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

    return { message: 'Roles updated successfully' };
  }
}
