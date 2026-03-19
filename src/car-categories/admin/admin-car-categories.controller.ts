import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AdminCarCategoriesService } from './admin-car-categories.service';
import { CreateCarCategoryDto } from '../dto/create-car-category.dto';
import { UpdateCarCategoryDto } from '../dto/update-car-category.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('admin/car-categories')
export class AdminCarCategoriesController {
  constructor(private readonly service: AdminCarCategoriesService) {}

  @Get()
  @Roles(Role.Admin)
  async getAll() {
    return this.service.getAllCategories();
  }

  @Post()
  @Roles(Role.Admin)
  async create(@Body() dto: CreateCarCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  async update(@Param('id') id: string, @Body() dto: UpdateCarCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async delete(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }
}
