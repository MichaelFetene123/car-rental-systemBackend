import { Module } from '@nestjs/common';
import { AdminLocationsController } from './controllers/admin-locations/admin-locations.controller';
import { LocationsController } from './controllers/locations.controller';
import { LocationsService } from './locations.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [LocationsController, AdminLocationsController],
  providers: [LocationsService, PrismaService],
})
export class LocationsModule {}
