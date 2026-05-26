import { IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  full_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  phone?: string;
}


export class ChangePasswordDto {
    @IsNotEmpty()
    currentPassword: string

    @IsNotEmpty()
    @MinLength(6)
    newPassword: string
}
