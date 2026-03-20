import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UserResponseDto } from 'src/users/dto/createUser.dto';

const SALT_ROUNDS = 10;

export type AuthResponse = {
  access_token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );

    return this.usersService.createUser({
      ...createUserDto,
      password: hashedPassword,
    });
  }

  async login(email: string, unhashedPassword: string): Promise<AuthResponse> {
    // 🔥 IMPORTANT: must include roles + permissions
    const user = await this.usersService.findUserByEmailWithRoles(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      unhashedPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // ✅ Extract roles (USE RoleType, NOT name)
    const roles = user.userRoles.map((ur) => ur.role.type);

    // ✅ Extract permissions (flatten)
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    // Optional: remove duplicates
    const uniquePermissions = [...new Set(permissions)];

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: uniquePermissions,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
