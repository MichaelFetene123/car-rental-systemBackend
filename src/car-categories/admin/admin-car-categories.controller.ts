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
import { Roles } from '../../auth/decorator/roles.decorator';
import { RequirePermission } from '../../auth/decorator/permission.decorator';
import { Role } from '../../common/enums/role.enum';
import { PermissionType } from '../../common/enums/permission.enum';

@Controller('admin/car-categories')
export class AdminCarCategoriesController {
  constructor(private readonly service: AdminCarCategoriesService) {}

  @Get()
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission(PermissionType.VIEW_CATEGORY)
  async getAll() {
    return this.service.getAllCategories();
  }

  @Post()
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission(PermissionType.MANAGE_CATEGORY)
  async create(@Body() dto: CreateCarCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission(PermissionType.MANAGE_CATEGORY)
  async update(@Param('id') id: string, @Body() dto: UpdateCarCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission(PermissionType.MANAGE_CATEGORY)
  async delete(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }
}
