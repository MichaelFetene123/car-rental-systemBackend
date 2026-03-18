import { Controller, Get } from '@nestjs/common';
import { CarCategoriesService } from './car-categories.service';

@Controller('car-categories')
export class CarCategoriesController {
  constructor(private readonly carCategoriesService: CarCategoriesService) {}

  @Get()
  async getCategoriest(){
   return this.carCategoriesService.getAllCategories()
  }


}
