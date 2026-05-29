import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdminPaymentSortBy {
  CreatedAt = 'createdAt',
  Amount = 'amount',
  Status = 'status',
  Method = 'method',
  PaidAt = 'paidAt',
}

export enum AdminPaymentSortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class AdminPaymentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(AdminPaymentSortBy)
  sortBy?: AdminPaymentSortBy = AdminPaymentSortBy.CreatedAt;

  @IsOptional()
  @IsEnum(AdminPaymentSortOrder)
  sortOrder?: AdminPaymentSortOrder = AdminPaymentSortOrder.Desc;
}
