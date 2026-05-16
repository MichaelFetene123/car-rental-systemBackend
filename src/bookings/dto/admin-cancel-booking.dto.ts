import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminCancelBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
