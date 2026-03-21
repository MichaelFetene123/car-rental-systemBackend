import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UserResponseDto } from 'src/users/dto/createUser.dto';
import { Role } from 'src/common/enums/role.enum';

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


  async login(email: string, password: string) {
    const user = await this.usersService.findUserByEmailWithRoles(email);

    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException();

    // ✅ map DB role.type → Role enum
    const roles: Role[] = user.userRoles.map((ur) => ur.role.type as Role);

    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: [...new Set(permissions)],
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
