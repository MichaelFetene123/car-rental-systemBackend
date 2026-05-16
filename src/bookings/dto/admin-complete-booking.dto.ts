import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AdminCompleteBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsDateString()
  actualReturnedAt?: string;
}
