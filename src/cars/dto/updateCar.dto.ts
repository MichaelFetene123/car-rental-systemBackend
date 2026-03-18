import { PartialType } from '@nestjs/mapped-types';
import { CreateCarDto } from './createCar.dto';

export class UpdateCarDto extends PartialType(CreateCarDto) {}
