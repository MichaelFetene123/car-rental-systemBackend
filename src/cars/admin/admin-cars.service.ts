import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCarDto } from '../dto/createCar.dto';
import { UpdateCarDto } from '../dto/updateCar.dto';
import {
  BookingStatus,
  CarStatus,
  Prisma,
} from '../../generated/prisma/client';

// for image
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AdminCarsService {
  constructor(private prisma: PrismaService) {}

  private async validateCategory(id?: string) {
    if (!id) return;
    const category = await this.prisma.carCategory.findUnique({
      where: { id },
    });
    if (!category)
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
  }

  private async validateLocation(id?: string) {
    if (!id) return;
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location)
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
  }

  private buildImageUrl(file?: Express.Multer.File): string | undefined {
    if (!file?.filename) return undefined;
    return `/uploads/${file.filename}`;
  }

  private safelyDeleteFile(imageUrl?: string | null) {
    if (!imageUrl) return;

    const normalized = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    const filePath = path.resolve(process.cwd(), normalized);

    if (!filePath.startsWith(path.resolve(process.cwd(), 'uploads'))) {
      return;
    }

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore filesystem errors so a delete doesn't fail after the DB record is removed.
      }
    }
  }

  private assertStatusCreateAllowed(status?: CarStatus) {
    if (status === 'rented') {
      throw new BadRequestException(
        'Cars cannot be created as rented without an approved booking',
      );
    }
  }

  private async assertStatusUpdateAllowed(id: string, status?: CarStatus) {
    if (!status) return;

    const activeBookingCount = await this.prisma.booking.count({
      where: {
        carId: id,
        status: {
          in: [BookingStatus.approved, BookingStatus.active],
        },
      },
    });

    if (status === 'rented' && activeBookingCount === 0) {
      throw new BadRequestException(
        'Cars cannot be marked as rented without an approved booking',
      );
    }

    if (status !== 'rented' && activeBookingCount > 0) {
      throw new BadRequestException(
        'Cars with approved or active bookings cannot be set to available or maintenance',
      );
    }
  }

  async createCar(dto: CreateCarDto, file?: Express.Multer.File) {
    try {
      await this.validateCategory(dto.categoryId);
      await this.validateLocation(dto.homeLocationId);
      this.assertStatusCreateAllowed(dto.status);

      const imageUrl = this.buildImageUrl(file);

      return await this.prisma.car.create({
        data: {
          name: dto.name,
          year: dto.year,
          seats: dto.seats,
          transmission: dto.transmission,
          pricePerDay: new Prisma.Decimal(dto.pricePerDay),
          status: dto.status ?? 'available',
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.fuelType && { fuelType: dto.fuelType }),
          ...(dto.description && { description: dto.description }),
          ...(dto.homeLocationId && { homeLocationId: dto.homeLocationId }),
          ...(imageUrl && { imageUrl }),
        },
        include: { category: true, homeLocation: true },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(`Unable to create car: ${error.message}`);
      }

      throw new InternalServerErrorException(
        'Unable to create car. Please verify the provided data and image.',
      );
    }
  }

  async updateCar(id: string, dto: UpdateCarDto, file?: Express.Multer.File) {
    try {
      const existingCar = await this.prisma.car.findUnique({ where: { id } });
      if (!existingCar) {
        throw new HttpException('Car not found', HttpStatus.NOT_FOUND);
      }

      const imageUrl = this.buildImageUrl(file);
      const fieldUpdates = [
        dto.name !== undefined && dto.name !== existingCar.name,
        dto.year !== undefined && dto.year !== existingCar.year,
        dto.seats !== undefined && dto.seats !== existingCar.seats,
        dto.transmission !== undefined &&
          dto.transmission !== existingCar.transmission,
        dto.pricePerDay !== undefined &&
          Number(dto.pricePerDay) !== Number(existingCar.pricePerDay),
        dto.status !== undefined && dto.status !== existingCar.status,
        dto.categoryId !== undefined &&
          dto.categoryId !== existingCar.categoryId,
        dto.fuelType !== undefined && dto.fuelType !== existingCar.fuelType,
        dto.description !== undefined &&
          dto.description !== existingCar.description,
        dto.homeLocationId !== undefined &&
          dto.homeLocationId !== existingCar.homeLocationId,
      ];

      const hasFieldUpdates = fieldUpdates.some(Boolean);
      const hasImageUpdate =
        imageUrl !== undefined && imageUrl !== existingCar.imageUrl;

      if (!hasFieldUpdates && !hasImageUpdate) {
        throw new BadRequestException('No changes provided to update.');
      }

      await this.validateCategory(dto.categoryId);
      await this.validateLocation(dto.homeLocationId);
      await this.assertStatusUpdateAllowed(id, dto.status);

      const updatedCar = await this.prisma.car.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.year !== undefined && { year: dto.year }),
          ...(dto.seats !== undefined && { seats: dto.seats }),
          ...(dto.transmission !== undefined && {
            transmission: dto.transmission,
          }),
          ...(dto.pricePerDay !== undefined && {
            pricePerDay: new Prisma.Decimal(dto.pricePerDay),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.fuelType !== undefined && { fuelType: dto.fuelType }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.homeLocationId !== undefined && {
            homeLocationId: dto.homeLocationId,
          }),
          ...(imageUrl && { imageUrl }),
        },
        include: { category: true, homeLocation: true },
      });

      if (
        imageUrl &&
        existingCar.imageUrl &&
        existingCar.imageUrl !== imageUrl
      ) {
        this.safelyDeleteFile(existingCar.imageUrl);
      }

      return updatedCar;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(`Unable to update car: ${error.message}`);
      }

      throw new InternalServerErrorException(
        'Unable to update car. Please verify the provided data and image.',
      );
    }
  }

  async deleteCar(id: string) {
    try {
      const existingCar = await this.prisma.car.findUnique({ where: { id } });
      if (!existingCar) {
        throw new HttpException('Car not found', HttpStatus.NOT_FOUND);
      }

      const activeBookingCount = await this.prisma.booking.count({
        where: {
          carId: id,
          status: { in: [BookingStatus.approved, BookingStatus.active] },
        },
      });

      if (activeBookingCount > 0) {
        throw new BadRequestException(
          'Cannot delete a car with approved or active bookings.',
        );
      }

      await this.prisma.car.delete({ where: { id } });
      this.safelyDeleteFile(existingCar.imageUrl);
      return { message: 'Car deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Cannot delete this car because it is still referenced by other records.',
          );
        }

        throw new BadRequestException(`Unable to delete car: ${error.message}`);
      }

      throw new InternalServerErrorException(
        'Unable to delete car. Please try again.',
      );
    }
  }

  async getAllCars() {
    return this.prisma.car.findMany({
      include: { category: true, homeLocation: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
