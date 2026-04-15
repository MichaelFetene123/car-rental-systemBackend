import { Controller, Get, Param } from '@nestjs/common';
import { CarsService } from './cars.service';
import { Public } from '../auth/decorator/public.decorator';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get()
  @Public()
  async getAll() {
    return this.carsService.getAllCars();
  }

  @Get(':id')
  @Public()
  async getOne(@Param('id') id: string) {
    return this.carsService.getCarById(id);
  }
}
