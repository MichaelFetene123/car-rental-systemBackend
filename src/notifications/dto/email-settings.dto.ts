import { IsString, IsNumber } from 'class-validator';

export class UpdateEmailSettingsDto {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  fromName: string;

  @IsString()
  fromEmail: string;
}
