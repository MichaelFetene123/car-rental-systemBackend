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
import { RolesService } from './role-and-permission/roles/roles.service';
import { RolesController } from './role-and-permission/roles/roles.controller';
import { RolesModule } from './role-and-permission/roles/roles.module';
import { PermissionsModule } from './role-and-permission/permissions/permissions.module';
import { UserRolesModule } from './user-roles/user-roles.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModuleTsModule } from './payments.module.ts/payments.module.ts.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UsersModule,
    AuthModule,
    LocationsModule,
    CarsModule,
    CarCategoriesModule,
    RolesModule,
    PermissionsModule,
    UserRolesModule,
    BookingsModule,
    PaymentsModuleTsModule,
    PaymentsModule,
    NotificationsModule,
    DashboardModule,
  ],
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
