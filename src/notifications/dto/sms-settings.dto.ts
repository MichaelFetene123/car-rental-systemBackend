import { IsString } from 'class-validator';

export class UpdateSmsSettingsDto {
  @IsString()
  provider: string;

  @IsString()
  accountSid: string;

  @IsString()
  authToken: string;

  @IsString()
  fromNumber: string;
}
