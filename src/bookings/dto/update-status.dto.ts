import { IsEnum, IsUUID } from 'class-validator';
import { BookingStatus } from '../../generated/prisma/client';

export class UpdateBookingStatusDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(BookingStatus)
  status: BookingStatus;
}
