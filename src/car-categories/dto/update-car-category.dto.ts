// update-car-category.dto.ts example
import { PartialType } from '@nestjs/mapped-types';
import { CreateCarCategoryDto } from './create-car-category.dto';

export class UpdateCarCategoryDto extends PartialType(CreateCarCategoryDto) {}
