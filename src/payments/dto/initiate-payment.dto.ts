import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class InitiatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  phone?: string;
}
