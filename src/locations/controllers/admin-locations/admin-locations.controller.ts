import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseBoolPipe,
} from '@nestjs/common';

import { LocationsService } from '../../locations.service';
import { CreateLocationDto } from '../../dto/create-location.dto';
import { UpdateLocationDto } from '../../dto/update-location.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('admin/locations')
export class AdminLocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // List all locations (admin panel)
  @Get()
  @Roles(Role.Admin) // Only admin can access this endpoint
  getAllLocations() {
    return this.locationsService.getAllLocations();
  }

  // Create a new location
  @Post()
  @Roles(Role.Admin) // Only admin can create locations
  createLocation(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.createLocation(createLocationDto);
  }

  // Update an existing location
  @Patch(':id')
  @Roles(Role.Admin) // Only admin can update locations
  updateLocation(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.updateLocation(id, updateLocationDto);
  }

  // Delete a location
  @Delete(':id')
  @Roles(Role.Admin) // Only admin can delete locations
  deleteLocation(@Param('id') id: string) {
    return this.locationsService.deleteLocation(id);
  }

  // Toggle location status (active/inactive)
  @Patch(':id/status')
  @Roles(Role.Admin) // Only admin can toggle location status
  toggleLocationStatus(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
  ) {
    return this.locationsService.toggleStatus(id, isActive);
  }
}
