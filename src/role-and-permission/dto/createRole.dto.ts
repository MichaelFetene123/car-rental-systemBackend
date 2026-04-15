import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsUUID,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(Role)
  type: Role;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
