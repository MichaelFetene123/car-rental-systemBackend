// src/locations/dto/location-query.dto.ts

import { IsOptional, IsString, IsBooleanString } from 'class-validator';

export class LocationQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsBooleanString()
  is_active?: string;
}
