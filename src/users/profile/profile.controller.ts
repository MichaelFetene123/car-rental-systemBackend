import { Controller, Get, Patch, Req, Body  } from "@nestjs/common";
import { UpdateProfileDto, ChangePasswordDto } from "../dto/updateProfile.dto";
import { UsersService } from "../users.service";


@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch()
  async updateProfile(
    @Req() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }
  @Patch('password')
  async changePassword(
    @Req() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }
}
