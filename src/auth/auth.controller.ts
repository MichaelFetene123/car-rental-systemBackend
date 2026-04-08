import {
  Body,
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { CreateUserDto, LoginUserDto } from 'src/users/dto/createUser.dto';
import { JwtPayload } from './types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async login(@Body() loginDto: LoginUserDto) {
    const { email, password } = loginDto;
    const token = await this.authService.login(email, password);
    if (!token) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return token;
  }

  @Post('logout')
  async logout(@Req() req: { user: JwtPayload }) {
    return this.authService.logout(req.user.sub);
  }
}
