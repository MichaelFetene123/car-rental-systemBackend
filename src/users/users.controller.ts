import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/createUser.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Create user
  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  // Get all users
  @Get()
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  // Get user by id
  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.usersService.findUserById(id);
  }

  // Get user by email
  @Get('email/:email')
  getUserByEmail(@Param('email') email: string) {
    return this.usersService.findUserByEmail(email);
  }

  // Update user
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() data: Partial<CreateUserDto>) {
    return this.usersService.updateUser(id, data);
  }

  // Delete user
  @Delete(':id')
  deleteUser(@Param('id') id: string): Promise<void | null> {
    return this.usersService.deleteUser(id);
  }
}
