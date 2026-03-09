import { Module } from '@nestjs/common';
import { AdminControllerController } from './controllers/admin-controller/admin-controller.controller';
import { AdminLocationsController } from './controllers/admin-locations/admin-locations.controller';

@Module({
  controllers: [AdminControllerController, AdminLocationsController]
})
export class LocationsModule {}
