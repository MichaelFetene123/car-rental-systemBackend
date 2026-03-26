import { Module } from '@nestjs/common';
import { CarCategoriesService } from './car-categories.service';
import { CarCategoriesController } from './car-categories.controller';
import { AdminCarCategoriesService } from './admin/admin-car-categories.service';
import { AdminCarCategoriesController } from './admin/admin-car-categories.controller';
import { PrismaModule } from 'src/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CarCategoriesController, AdminCarCategoriesController],
  providers: [CarCategoriesService, AdminCarCategoriesService],
})
export class CarCategoriesModule {}
