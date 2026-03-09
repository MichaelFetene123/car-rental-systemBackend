// src/locations/dto/create-location.dto.ts

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(255)
  address: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsString()
  @MaxLength(100)
  state: string;

  @IsString()
  @MaxLength(20)
  zipCode: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
