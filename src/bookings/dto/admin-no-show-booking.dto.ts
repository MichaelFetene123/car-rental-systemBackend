import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminNoShowBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
