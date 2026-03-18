import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { PrismaService } from 'src/prisma.service';
import { AdminCarsController } from './admin/admin-cars.controller';
import { AdminCarsService } from './admin/admin-cars.service';

@Module({
  controllers: [CarsController, AdminCarsController],
  providers: [CarsService, PrismaService, AdminCarsService],
})
export class CarsModule {}
