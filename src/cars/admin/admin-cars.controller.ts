import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AdminCarsService } from './admin-cars.service';

import { Roles } from 'src/auth/decorator/roles.decorator';
import { RequirePermission } from 'src/auth/decorator/permission.decorator';

import { Role } from 'src/common/enums/role.enum';

@Controller('admin/cars')
export class AdminCarsController {
  constructor(private readonly adminCarsService: AdminCarsService) {}

  @Get()
  @Roles(Role.Admin)
  @RequirePermission('view_cars')
  async getAll() {
    return this.adminCarsService.getAllCars();
  }

  @Post()
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  async create(@Body() dto) {
    return this.adminCarsService.createCar(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  async update(@Param('id') id: string, @Body() dto) {
    return this.adminCarsService.updateCar(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  async delete(@Param('id') id: string) {
    return this.adminCarsService.deleteCar(id);
  }
}
