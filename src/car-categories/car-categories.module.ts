import { Module } from '@nestjs/common';
import { CarCategoriesService } from './car-categories.service';
import { CarCategoriesController } from './car-categories.controller';
import { AdminCarCategoriesService } from './admin/admin-car-categories.service';
import { AdminCarCategoriesController } from './admin/admin-car-categories.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CarCategoriesController, AdminCarCategoriesController],
  providers: [CarCategoriesService, AdminCarCategoriesService, PrismaService],
})
export class CarCategoriesModule {}
