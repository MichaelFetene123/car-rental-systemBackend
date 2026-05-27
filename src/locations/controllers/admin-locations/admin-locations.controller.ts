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
import { Roles } from '../../../auth/decorator/roles.decorator';
import { RequirePermission } from '../../../auth/decorator/permission.decorator';
import { Role } from '../../../common/enums/role.enum';

@Controller('admin/locations')
export class AdminLocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission('manage_locations')
  getAllLocations() {
    return this.locationsService.getAllLocations();
  }

  @Post()
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission('manage_locations')
  createLocation(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.createLocation(createLocationDto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission('manage_locations')
  updateLocation(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.updateLocation(id, updateLocationDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_locations')
  deleteLocation(@Param('id') id: string) {
    return this.locationsService.deleteLocation(id);
  }

  @Patch(':id/status')
  @Roles(Role.Admin, Role.Staff)
  @RequirePermission('manage_locations')
  toggleLocationStatus(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
  ) {
    return this.locationsService.toggleStatus(id, isActive);
  }
}
