import { Controller, Get } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RequirePermission } from 'src/auth/decorator/permission.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Get()
  @Roles(Role.Admin)
  @RequirePermission('manage_roles')
  getAll() {
    return this.service.getAllPermissions();
  }
}
