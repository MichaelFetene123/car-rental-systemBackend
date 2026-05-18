import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RefundMode } from './admin-reject-booking.dto';

export class AdminRejectBookingBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsEnum(RefundMode)
  refundMode?: RefundMode;
}
