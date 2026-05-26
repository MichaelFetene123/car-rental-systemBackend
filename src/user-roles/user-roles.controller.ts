import { Controller, Post, Delete, Get, Body, Param } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { Roles } from '../auth/decorator/roles.decorator';
import { RequirePermission } from '../auth/decorator/permission.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('user-roles')
export class UserRolesController {
  constructor(private service: UserRolesService) {}

  @Post('assign')
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  assign(@Body() dto: AssignRoleDto) {
    return this.service.assignRole(dto);
  }

  @Delete('remove')
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  remove(@Body() dto: RemoveRoleDto) {
    return this.service.removeRole(dto);
  }

  @Get(':userId')
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  getUserRoles(@Param('userId') userId: string) {
    return this.service.getUserRoles(userId);
  }
}
