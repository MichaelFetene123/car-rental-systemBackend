import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCarCategoryDto } from '../dto/create-car-category.dto';
import { UpdateCarCategoryDto } from '../dto/update-car-category.dto';

@Injectable()
export class AdminCarCategoriesService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCarCategoryDto) {
    // Check duplicate name
    const existing = await this.prisma.carCategory.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new HttpException('Category already exists', HttpStatus.BAD_REQUEST);
    }

    return this.prisma.carCategory.create({
      data: { name: dto.name },
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
      const existing = await this.prisma.carCategory.findFirst({
        where: { name: dto.name },
      });

      if (existing && existing.id !== id) {
        throw new HttpException('Category already exists', HttpStatus.BAD_REQUEST);
      }
    }

    return this.prisma.carCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
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
    return this.prisma.carCategory.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }
}
