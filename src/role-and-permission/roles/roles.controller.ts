import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from '../dto/createRole.dto';
import { UpdateRoleDto } from '../dto/updateRole.dto';
import { Roles } from '../../auth/decorator/roles.decorator';
import { RequirePermission } from '../../auth/decorator/permission.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  getAll() {
    return this.service.getAllRoles();
  }

  @Post()
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  create(@Body() dto: CreateRoleDto) {
    return this.service.createRole(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  remove(@Param('id') id: string) {
    return this.service.deleteRole(id);
  }
}
