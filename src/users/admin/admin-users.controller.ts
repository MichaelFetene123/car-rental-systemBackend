// admin/users.controller.ts
import { Controller, Patch, Param, Body, Get, Post, Delete } from '@nestjs/common';
import { UsersService } from '../users.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { CreateUserDto } from '../dto/createUser.dto';
import { UpdateUserDto } from '../dto/updateUser.dto';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Roles(Role.Admin)
  async getUsers() {
    return this.adminUsersService.getAllUsers();
  }

  @Post()
  @Roles(Role.Admin)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminUsersService.createUserByAdmin(createUserDto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminUsersService.updateUserByAdmin(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async deleteUser(@Param('id') id: string) {
    return this.adminUsersService.deleteUserByAdmin(id);
  }

  @Patch(':id/roles')
  @Roles(Role.Admin)
  async assignRoles(@Param('id') userId: string, @Body('roles') roles: Role[]) {
    return this.adminUsersService.assignRoles(userId, roles);
  }
}
