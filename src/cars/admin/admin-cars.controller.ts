import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { AdminCarsService } from './admin-cars.service';
import { CreateCarDto } from '../dto/createCar.dto';
import { UpdateCarDto } from '../dto/updateCar.dto';
import { Roles } from '../../auth/decorator/roles.decorator';
import { RequirePermission } from '../../auth/decorator/permission.decorator';
import { Role } from '../../common/enums/role.enum';

const uploadDir = path.resolve(process.cwd(), 'uploads');
const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageUploadInterceptor = FileInterceptor('image', {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const safeBaseName = path
        .parse(file.originalname)
        .name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const extension = path.extname(file.originalname) || '.jpg';
      cb(null, `${safeBaseName}_${Date.now()}${extension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

@Controller('admin/cars')
export class AdminCarsController {
  constructor(private readonly adminCarsService: AdminCarsService) {}

  private validateImageFile(file?: Express.Multer.File) {
    if (!file) return;

    const normalizedMimeType = file.mimetype.toLowerCase();
    const normalizedExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedImageMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException(
        `Invalid image type "${file.mimetype}". Allowed types: image/jpeg, image/jpg, image/png, image/webp.`,
      );
    }

    if (!allowedImageExtensions.has(normalizedExtension)) {
      throw new BadRequestException(
        `Invalid image extension "${normalizedExtension || 'none'}". Allowed extensions: .jpg, .jpeg, .png, .webp.`,
      );
    }
  }

  @Get()
  @Roles(Role.Admin)
  @RequirePermission('view_cars')
  async getAll() {
    return this.adminCarsService.getAllCars();
  }

  @Post()
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  @UseInterceptors(imageUploadInterceptor)
  async create(
    @Body() dto: CreateCarDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateImageFile(file);
    return this.adminCarsService.createCar(dto, file);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  @UseInterceptors(imageUploadInterceptor)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCarDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateImageFile(file);
    return this.adminCarsService.updateCar(id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @RequirePermission('manage_cars')
  async delete(@Param('id') id: string) {
    return this.adminCarsService.deleteCar(id);
  }
}
