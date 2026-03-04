import { All, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import type {
  UserCreateInput,
  UserModel,
  UserWhereUniqueInput,
} from '../generated/prisma/models/User';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async findUserByEmail(
    where: UserWhereUniqueInput,
  ): Promise<UserModel | null> {
    return this.prismaService.user.findUnique({ where });
  }

  async CreateUser(data: UserCreateInput) {
    return this.prismaService.user.create({ data });
  }

  // TEMPORARY FOR TESTING
  async AllUsers() {
    return this.prismaService.user.findMany();
  }
}
