import { Module } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { UserRolesController } from './user-roles.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserRolesController],
  providers: [UserRolesService],
})
export class UserRolesModule {}
