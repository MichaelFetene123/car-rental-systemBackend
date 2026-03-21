import { IsUUID } from 'class-validator';

export class RemoveRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  roleId: string;
}
