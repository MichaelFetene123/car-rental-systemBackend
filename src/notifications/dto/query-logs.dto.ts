import { IsOptional, IsEnum, IsString } from 'class-validator';
import {
  NotificationLogStatus,
  NotificationTemplateType,
} from '../../generated/prisma/client';

export class QueryLogsDto {
  @IsOptional()
  @IsEnum(NotificationLogStatus)
  status?: NotificationLogStatus;

  @IsOptional()
  @IsEnum(NotificationTemplateType)
  type?: NotificationTemplateType;

  @IsOptional()
  @IsString()
  search?: string;
}
