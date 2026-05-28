import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { ProfileController } from './profile/profile.controller';
import { UserInactivityCronService } from './user-inactivity.cron.service';
import { PrismaModule } from '../prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AdminUsersController, ProfileController],
  providers: [UsersService, AdminUsersService, UserInactivityCronService],
  exports: [UsersService],
})
export class UsersModule {}
