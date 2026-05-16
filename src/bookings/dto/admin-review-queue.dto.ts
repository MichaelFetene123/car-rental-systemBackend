import { IsBooleanString, IsOptional } from 'class-validator';

export class AdminReviewQueueDto {
  @IsOptional()
  @IsBooleanString()
  paidOnly?: string;
}
