import { IsString, MaxLength } from 'class-validator';

export class CreateCarCategoryDto {
  @IsString()
  @MaxLength(120)
  name: string;
}
