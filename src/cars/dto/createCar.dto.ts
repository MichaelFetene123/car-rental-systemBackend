import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CarStatus } from '../../generated/prisma/enums';

export class CreateCarDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  seats: number;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsString()
  transmission: string;

  @Type(() => Number)
  @IsNumber()
  pricePerDay: number;

  @IsOptional()
  @IsEnum(CarStatus)
  status?: CarStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  homeLocationId?: string;
}
