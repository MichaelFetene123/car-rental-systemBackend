import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCarCategoryDto } from '../dto/create-car-category.dto';
import { UpdateCarCategoryDto } from '../dto/update-car-category.dto';

@Injectable()
export class AdminCarCategoriesService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCarCategoryDto) {
    const normalizedName = dto.name.trim();

    if (!normalizedName) {
      throw new HttpException(
        'Category name is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check duplicate name
    const existing = await this.prisma.carCategory.findFirst({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new HttpException(
        'Category already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.carCategory.create({
      data: { name: normalizedName },
    });
  }

  async updateCategory(id: string, dto: UpdateCarCategoryDto) {
    const category = await this.prisma.carCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    // Optional duplicate check
    if (dto.name) {
      const normalizedName = dto.name.trim();
      if (!normalizedName) {
        throw new HttpException(
          'Category name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const existing = await this.prisma.carCategory.findFirst({
        where: { name: normalizedName },
      });

      if (existing && existing.id !== id) {
        throw new HttpException(
          'Category already exists',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check for active bookings when deactivating category
    if (
      typeof dto.isActive === 'boolean' &&
      !dto.isActive &&
      category.isActive
    ) {
      const bookedCars = await this.prisma.booking.findMany({
        where: {
          car: {
            categoryId: id,
          },
          status: {
            in: ['approved', 'active', 'pending'],
          },
        },
        select: {
          id: true,
          car: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (bookedCars.length > 0) {
        throw new HttpException(
          `Category has booked cars: ${bookedCars.map((b) => b.car.name).join(', ')}`,
          HttpStatus.CONFLICT,
        );
      }
    }

    return this.prisma.carCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(typeof dto.isActive === 'boolean' && { isActive: dto.isActive }),
      },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.carCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }

    // IMPORTANT: prevent deleting if used by cars
    const used = await this.prisma.car.findFirst({
      where: { categoryId: id },
    });

    if (used) {
      throw new HttpException(
        'Cannot delete category: it is used by cars',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.carCategory.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }

  async getAllCategories() {
    const categories = await this.prisma.carCategory.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
        _count: {
          select: {
            cars: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      updatedAt: category.updatedAt,
      carsCount: category._count.cars,
    }));
  }
}
