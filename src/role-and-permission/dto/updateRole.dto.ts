import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './createRole.dto';
import { IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
