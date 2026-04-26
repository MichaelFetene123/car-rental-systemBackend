import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UserResponseDto } from '../users/dto/createUser.dto';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma.service';
import { JwtPayload } from './types/jwt-payload.type';
import { jwtConstants } from './constants';

const SALT_ROUNDS = 10;

export type AuthResponse = {
  access_token: string;
};

type RefreshTokenPayload = {
  sub: string;
  tokenVersion: number;
  tokenType: 'refresh';
};

type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
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

    return this.createAuthTokens({
      sub: user.id,
      email: user.email,
      roles,
      permissions: [...new Set(permissions)],
      tokenVersion: user.tokenVersion,
    });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let refreshPayload: RefreshTokenPayload;

    try {
      refreshPayload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: jwtConstants.refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshPayload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: refreshPayload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.tokenVersion !== refreshPayload.tokenVersion) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
      select: {
        tokenVersion: true,
      },
    });

    const roles: Role[] = user.userRoles.map((ur) => ur.role.type as Role);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    return this.createAuthTokens({
      sub: user.id,
      email: user.email,
      roles,
      permissions: [...new Set(permissions)],
      tokenVersion: updated.tokenVersion,
    });
  }

  private async createAuthTokens(payload: JwtPayload): Promise<AuthTokens> {
    const refreshPayload: RefreshTokenPayload = {
      sub: payload.sub,
      tokenVersion: payload.tokenVersion,
      tokenType: 'refresh',
    };

    return {
      access_token: await this.jwtService.signAsync(payload, {
        secret: jwtConstants.accessSecret,
        expiresIn: jwtConstants.accessTokenExpiresIn as any,
      }),
      refresh_token: await this.jwtService.signAsync(refreshPayload, {
        secret: jwtConstants.refreshSecret,
        expiresIn: jwtConstants.refreshTokenExpiresIn as any,
      }),
    };
  }

  async generateUserToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const roles = user.userRoles.map((ur) => ur.role.type);

    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      tokenVersion: user.tokenVersion,
    };

    return {
      access_token: await this.jwtService.signAsync(payload, {
        secret: jwtConstants.accessSecret,
        expiresIn: jwtConstants.accessTokenExpiresIn as any,
      }),
    };
  }

  async logout(userId: string) {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      throw new UnauthorizedException('User not found');
    }

    return { message: 'Logout successful' };
  }
}
