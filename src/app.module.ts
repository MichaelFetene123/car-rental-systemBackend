import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { LocationsModule } from './locations/locations.module';
import { CarsModule } from './cars/cars.module';
import { CarCategoriesModule } from './car-categories/car-categories.module';

@Module({
  imports: [ConfigModule.forRoot(), UsersModule, AuthModule, LocationsModule, CarsModule, CarCategoriesModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    AppService,
  ],
})
export class AppModule {}
