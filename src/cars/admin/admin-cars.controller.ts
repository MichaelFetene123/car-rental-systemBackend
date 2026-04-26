import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AdminCarsService } from './admin-cars.service';

import { Roles } from '../../auth/decorator/roles.decorator';
import { RequirePermission } from '../../auth/decorator/permission.decorator';

import { Role } from '../../common/enums/role.enum';

//  for image upload
import { FileInterceptor } from '@nestjs/platform-express';

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
  @UseInterceptors(FileInterceptor('image')) // Handle 'image' file upload
  async create(@Body() dto: any, @UploadedFile() file?: Express.Multer.File) {
    return this.adminCarsService.createCar(dto, file);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  @UseInterceptors(FileInterceptor('image')) // 🔥 important
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adminCarsService.updateCar(id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  async delete(@Param('id') id: string) {
    return this.adminCarsService.deleteCar(id);
  }
}
