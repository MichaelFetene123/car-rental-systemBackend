import { IsUUID, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PaymentMethod } from 'src/generated/prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsNumber()
  fees?: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
