// admin/users.controller.ts
import { Controller, Patch, Param, Body } from '@nestjs/common';
import { UsersService } from '../users.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/roles')
  @Roles(Role.Admin)
  async assignRoles(@Param('id') userId: string, @Body('roles') roles: Role[]) {
    return this.usersService.assignRoles(userId, roles);
  }
}
