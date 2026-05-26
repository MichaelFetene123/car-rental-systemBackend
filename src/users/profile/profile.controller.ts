import { Controller, Get, Patch, Req, Body } from '@nestjs/common';
import { UpdateProfileDto, ChangePasswordDto } from '../dto/updateProfile.dto';
import { UsersService } from '../users.service';

interface JwtUser {
  sub: string;
}


@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: { user: JwtUser }) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Patch()
  async updateProfile(
    @Req() req: { user: JwtUser },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.sub, updateProfileDto);
  }
  @Patch('password')
  async changePassword(
    @Req() req: { user: JwtUser },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.sub, changePasswordDto);
  }
}
