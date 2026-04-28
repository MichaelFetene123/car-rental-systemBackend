import { IsUUID, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  carId: string;

  @IsUUID()
  pickupLocationId: string;

  @IsUUID()
  returnLocationId: string;

  @IsDateString()
  pickupAt: string;

  @IsDateString()
  returnAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}
