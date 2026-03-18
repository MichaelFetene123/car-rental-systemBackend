import { Controller, Get, Param } from '@nestjs/common';
import { CarsService } from './cars.service';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get()
  async getAll() {
    return this.carsService.getAllCars();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.carsService.getCarById(id);
  }
}
