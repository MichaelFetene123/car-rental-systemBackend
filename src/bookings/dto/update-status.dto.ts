import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BookingStatus } from '../../generated/prisma/client';
import { RefundMode } from './admin-reject-booking.dto';

export class UpdateBookingStatusDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;

  @IsOptional()
  @IsDateString()
  actualReturnedAt?: string;

  @IsOptional()
  @IsEnum(RefundMode)
  refundMode?: RefundMode;
}
