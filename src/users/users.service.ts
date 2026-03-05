import {Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  UserCreateInput,
  UserModel,
  UserWhereUniqueInput,
} from '../generated/prisma/models/User';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async createUser(data: UserCreateInput){
    return this.prismaService.user.create({
      data,
    });
  }
}
