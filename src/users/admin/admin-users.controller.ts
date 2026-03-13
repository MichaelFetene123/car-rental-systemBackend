// admin/users.controller.ts
import { Controller, Patch, Param, Body, Get, Post } from '@nestjs/common';
import { UsersService } from '../users.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { CreateUserDto } from '../dto/createUser.dto';
import { UpdateUserDto } from '../dto/updateUser.dto';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers() {
    return this.usersService.getAllUsers();
  }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  // @Patch('id')
  // async updateUser(@Param('id') id: string, updateUserDto: UpdateUserDto) {
  //   return this.usersService.updateUser()
  // }

  @Patch(':id/roles')
  @Roles(Role.Admin)
  async assignRoles(@Param('id') userId: string, @Body('roles') roles: Role[]) {
    return this.usersService.assignRoles(userId, roles);
  }
}
