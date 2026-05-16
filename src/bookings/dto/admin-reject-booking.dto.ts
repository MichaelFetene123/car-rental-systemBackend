import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum RefundMode {
  AUTO = 'auto',
  MANUAL_REVIEW = 'manual_review',
}

export class AdminRejectBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsEnum(RefundMode)
  refundMode?: RefundMode;
}
