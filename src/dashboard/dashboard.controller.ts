import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(Role.Admin)
  getDashboard() {
    return this.dashboardService.getDashboardData();
  }
}
