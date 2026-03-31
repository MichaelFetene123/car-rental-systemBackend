import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';

export class SendBulkNotificationDto {
  @IsEnum(['email', 'sms'])
  type: 'email' | 'sms';

  @IsEnum(['all', 'specific'])
  recipientType: 'all' | 'specific';

  @IsOptional()
  @IsArray()
  userIds?: string[];

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  message: string;
}
