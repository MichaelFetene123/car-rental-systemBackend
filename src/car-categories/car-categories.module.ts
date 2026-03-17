import { Module } from '@nestjs/common';
import { CarCategoriesService } from './car-categories.service';
import { CarCategoriesController } from './car-categories.controller';

@Module({
  controllers: [CarCategoriesController],
  providers: [CarCategoriesService],
})
export class CarCategoriesModule {}
