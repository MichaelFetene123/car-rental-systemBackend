import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
