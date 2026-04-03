// dto/query-report.dto.ts
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum ReportType {
  DAILY = 'daily',
  MONTHLY = 'monthly',
}

export enum MetricType {
  REVENUE = 'revenue',
  BOOKINGS = 'bookings',
  CARS_RENTED = 'cars_rented',
}

export class QueryReportDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType = ReportType.DAILY;

  @IsOptional()
  @IsEnum(MetricType)
  metric?: MetricType = MetricType.REVENUE;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
