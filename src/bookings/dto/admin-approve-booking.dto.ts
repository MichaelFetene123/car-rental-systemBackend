import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminApproveBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
