import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async createLocation(createLocationDto: CreateLocationDto) {
    return this.prisma.location.create({ data: createLocationDto });
  }

  async updateLocation(id: string, updateLocationDto: UpdateLocationDto) {
    return this.prisma.location.update({
      where: { id },
      data: updateLocationDto,
    });
  }

  async deleteLocation(id: string) {
    return this.prisma.location.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string, isActive: boolean) {
    if (!isActive) {
      const [activeBookings, pendingBookings, ongoingRentals, activeVehicles] =
        await Promise.all([
          this.prisma.booking.count({
            where: {
              deletedAt: null,
              status: 'approved',
              OR: [{ pickupLocationId: id }, { returnLocationId: id }],
            },
          }),
          this.prisma.booking.count({
            where: {
              deletedAt: null,
              status: 'pending',
              OR: [{ pickupLocationId: id }, { returnLocationId: id }],
            },
          }),
          this.prisma.booking.count({
            where: {
              deletedAt: null,
              status: 'active',
              OR: [{ pickupLocationId: id }, { returnLocationId: id }],
            },
          }),
          // Only consider cars that are actually in active use (rented).
          // Cars that are merely `available` at a location should not block deactivation.
          this.prisma.car.count({
            where: {
              homeLocationId: id,
              status: { in: ['rented'] },
            },
          }),
        ]);

      const dependencyCounts = {
        activeBookings,
        pendingBookings,
        ongoingRentals,
        activeVehicles,
      };

      const totalDependencies = Object.values(dependencyCounts).reduce(
        (sum, count) => sum + count,
        0,
      );

      if (totalDependencies > 0) {
        throw new BadRequestException(
          {
            message:
              'Cannot deactivate location. Resolve active dependencies first.',
            dependencies: dependencyCounts,
            totalDependencies,
          },
        );
      }
    }

    return this.prisma.location.update({
      where: { id },
      data: { isActive },
    });
  }

  async getAllLocations() {
    return this.prisma.location.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLocations(query: LocationQueryDto) {
    const { city, state, is_active } = query;

    const where: any = {};

    if (city) {
      where.city = {
        contains: city,
        mode: 'insensitive',
      };
    }
    if (state) {
      where.state = {
        contains: state,
        mode: 'insensitive',
      };
    }
    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }
    const locations = await this.prisma.location.findMany({
      where,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: locations,
      meta: {
        total: locations.length,
        count: locations.length,
      },
    };
  }

  async getLocationById(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });
    if (!location) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
    return location;
  }
}
