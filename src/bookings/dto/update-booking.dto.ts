import { IsUUID, IsDateString } from 'class-validator';

export class UpdateBookingDto {
  @IsUUID()
  bookingId: string;

  @IsDateString()
  pickupAt: string;

  @IsDateString()
  returnAt: string;

  @IsUUID()
  pickupLocationId: string;

  @IsUUID()
  returnLocationId: string;
}
