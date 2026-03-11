import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guard/auth.guard';
import { RolesGuard } from './guard/roles.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '3600s' }, // longer token expiry
    }),
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard }, // JWT guard globally
    { provide: APP_GUARD, useClass: RolesGuard }, // Roles guard globally
  ],
  controllers: [AuthController],
})
export class AuthModule {}
