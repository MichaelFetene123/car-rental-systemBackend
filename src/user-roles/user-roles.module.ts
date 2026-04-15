import { Module } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { UserRolesController } from './user-roles.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserRolesController],
  providers: [UserRolesService],
})
export class UserRolesModule {}
