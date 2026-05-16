import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class AdminInspectBookingDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lateFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  damageNotes?: string;

  @IsOptional()
  @IsBoolean()
  createAdditionalPayment?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  additionalPaymentMethod?: PaymentMethod;
}
