import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCarCategoryDto } from './create-car-category.dto';

export class UpdateCarCategoryDto extends PartialType(CreateCarCategoryDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
