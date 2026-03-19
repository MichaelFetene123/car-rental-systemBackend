import { Controller, Get, Param } from '@nestjs/common';
import { CarCategoriesService } from './car-categories.service';

@Controller('car-categories')
export class CarCategoriesController {
  constructor(private readonly service: CarCategoriesService) {}

  @Get()
  async getAll() {
    return this.service.getAllCategories();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getCategoryById(id);
  }
}
