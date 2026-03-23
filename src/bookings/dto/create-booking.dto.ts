import { IsUUID, IsDateString } from 'class-validator';

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
}
