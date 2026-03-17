import {IsString, IsNumber, IsOptional, IsEnum, IsUUID } from "class-validator"
import { CarStatus } from "src/generated/prisma/enums";


export class CreateCarDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsNumber()
  year: number;

  @IsNumber()
  seats: number;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsString()
  transmission: string;

  @IsNumber()
  pricePerDay: number;

  @IsOptional()
  @IsEnum(CarStatus)
  status?: CarStatus;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  homeLocationId?: string
}
