import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaymentStatus, PaymentMethod } from 'src/generated/prisma/client';

export class QueryPaymentDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  search?: string;
}
