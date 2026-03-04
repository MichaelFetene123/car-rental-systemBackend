export class CreateUserDto {
  id?: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  total_bookings?: number;
  created_at?: Date;
  updated_at?: Date;
}
