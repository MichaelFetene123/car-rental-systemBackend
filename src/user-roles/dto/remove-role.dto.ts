import { IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveRoleDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;

  @IsUUID('4')
  @IsNotEmpty()
  roleId: string;
}
