import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { AdminCarsController } from './admin/admin-cars.controller';
import { AdminCarsService } from './admin/admin-cars.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CarsController, AdminCarsController],
  providers: [CarsService, AdminCarsService],
})
export class CarsModule {}
