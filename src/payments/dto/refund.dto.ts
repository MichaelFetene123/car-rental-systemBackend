import { IsUUID, IsNumber, IsString, Min } from 'class-validator';

export class RefundDto {
  @IsUUID()
  paymentId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  reason: string;
}
