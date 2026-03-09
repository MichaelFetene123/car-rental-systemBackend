import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from '../locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  getLocations(@Query() query:LocationQueryDto) {
    return this.locationsService.getLocations();
  }


}
