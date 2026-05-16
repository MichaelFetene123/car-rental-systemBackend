import { IsUUID } from 'class-validator';

export class AdminPickupBookingDto {
  @IsUUID()
  bookingId: string;
}
