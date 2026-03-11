import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateUserDto,
  UserResponseDto,
  publicUserSelect,
} from './dto/createUser.dto';
import { Role } from 'src/auth/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
              connect: { name: 'user' }, // assign default 'user' role
            },
          },
        },
      },
      select: publicUserSelect,
    });
    return createUser;
  }

  async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user;
  }

  async assignRoles(userId: string, roles: Role[]) {
    // Remove old roles
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // Get Role IDs from names
    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roles } },
    });

    // Create userRoles
    await this.prisma.userRole.createMany({
      data: roleRecords.map((r) => ({ userId, roleId: r.id })),
      skipDuplicates: true,
    });

    return { message: 'Roles updated successfully' };
  }
}
