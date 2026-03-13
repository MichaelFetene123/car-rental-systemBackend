import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { AdminUsersController } from './admin/admin-users.controller';
import { ProfileController } from './profile/profile.controller';

@Module({
  controllers: [AdminUsersController, ProfileController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
