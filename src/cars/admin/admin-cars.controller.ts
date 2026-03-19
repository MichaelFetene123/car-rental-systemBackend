import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminCarsService } from './admin-cars.service';
import { CreateCarDto } from '../dto/createCar.dto';
import { UpdateCarDto } from '../dto/updateCar.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('admin/cars')
export class AdminCarsController {
  constructor(private readonly adminCarsService: AdminCarsService) {}

  @Get()
  @Roles(Role.Admin) // Only admins can access
  async getAll() {
    return this.adminCarsService.getAllCars();
  }

  @Post()
  @Roles(Role.Admin)
  async create(@Body() dto: CreateCarDto) {
    return this.adminCarsService.createCar(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  async update(@Param('id') id: string, @Body() dto: UpdateCarDto) {
    return this.adminCarsService.updateCar(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async delete(@Param('id') id: string) {
    return this.adminCarsService.deleteCar(id);
  }
}
