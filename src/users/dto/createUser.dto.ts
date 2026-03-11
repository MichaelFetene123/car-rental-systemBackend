import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(120)
  full_name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class LoginUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(255)
  password: string;
}

export class UserResponseDto {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  total_bookings: number | null;
  created_at: Date;
  updated_at: Date;
  roles?: string[]; // array of role names
}

export const publicUserSelect = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  status: true,
  total_bookings: true,
  created_at: true,
  updated_at: true,
  userRoles: {
    select: {
      role: {
        select: { name: true }, // return only role names
},
    },
  },
};
