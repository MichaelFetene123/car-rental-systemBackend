import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { LocationsService } from './locations/locations.service';
import { LocationsController } from './locations/controllers/locations.controller';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [ConfigModule.forRoot(), UsersModule, AuthModule, LocationsModule],
  controllers: [AppController, LocationsController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    AppService,
    LocationsService,
  ],
})
export class AppModule {}
