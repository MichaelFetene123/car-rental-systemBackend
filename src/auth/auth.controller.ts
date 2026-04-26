import {
  Body,
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { CreateUserDto, LoginUserDto } from '../users/dto/createUser.dto';
import { JwtPayload } from './types/jwt-payload.type';
import type { Response } from 'express';
import { jwtConstants } from './constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(jwtConstants.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: jwtConstants.refreshCookieMaxAgeMs,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(jwtConstants.refreshCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
    });
  }

  private extractCookieValue(cookieHeader: string | undefined, key: string) {
    if (!cookieHeader) return null;

    const parts = cookieHeader.split(';').map((item) => item.trim());
    const match = parts.find((item) => item.startsWith(`${key}=`));

    if (!match) return null;

    const [, value] = match.split('=');
    return value ?? null;
  }

  @Get('me')
  me(@Req() req: { user: unknown }) {
    return req.user;
  }

  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return await this.authService.register(createUserDto);
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { email, password } = loginDto;
    const tokens = await this.authService.login(email, password);
    if (!tokens) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    this.setRefreshCookie(response, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: { headers: { cookie?: string } },
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.extractCookieValue(
      req.headers.cookie,
      jwtConstants.refreshCookieName,
    );

    if (!refreshToken) {
      throw new HttpException('Refresh token missing', HttpStatus.UNAUTHORIZED);
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setRefreshCookie(response, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: { user: JwtPayload },
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearRefreshCookie(response);
    return this.authService.logout(req.user.sub);
  }
}
