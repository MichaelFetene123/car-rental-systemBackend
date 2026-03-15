import { Controller, Get, Patch, Req, Body  } from "@nestjs/common";
import { UpdateProfileDto, ChangePasswordDto } from "../dto/updateProfile.dto";
import { UsersService } from "../users.service";
import { Request } from "express";


@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: Request) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch()
  async updatePrifile(
    @Req() req: Request,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }
  @Patch('password')
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }
}
