import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';

import { jwtConstants } from './constants';

import { AuthGuard } from './guard/auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { PermissionGuard } from './guard/permission.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.accessSecret,
      signOptions: { expiresIn: jwtConstants.accessTokenExpiresIn as any },
    }),
  ],
  providers: [
    AuthService,

    // ORDER MATTERS
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
