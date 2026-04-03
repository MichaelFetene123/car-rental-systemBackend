import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from 'src/auth/decorator/permission.decorator';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { PermissionType } from 'src/common/enums/permission.enum';
import { Role } from 'src/common/enums/role.enum';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.VIEW_DASHBOARD)
  getDashboard() {
    return this.dashboardService.getDashboardData();
  }
}
