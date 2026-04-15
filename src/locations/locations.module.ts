import { Module } from '@nestjs/common';
import { AdminLocationsController } from './controllers/admin-locations/admin-locations.controller';
import { LocationsController } from './controllers/locations.controller';
import { LocationsService } from './locations.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LocationsController, AdminLocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
