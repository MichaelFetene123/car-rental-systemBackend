import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocationsService } from '../locations.service';
import { LocationQueryDto } from '../dto/location-query.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  getLocations(@Query() query:LocationQueryDto) {
    return this.locationsService.getLocations(query);
  }

  @Get(':id')
  getLocationById(@Param('id') id:string){
    return this.locationsService.getLocationById(id)
  }


}
