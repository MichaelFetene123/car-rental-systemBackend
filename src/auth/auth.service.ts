import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UserResponseDto } from '../users/dto/createUser.dto';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma.service';
import { JwtPayload } from './types/jwt-payload.type';
import { jwtConstants } from './constants';
import { EmailService } from '../email/email.service';
import { createHash, randomBytes } from 'crypto';

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
    private emailService: EmailService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<any> {
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );

    let user: UserResponseDto;

    try {
      user = await this.usersService.createUser({
        ...createUserDto,
        password: hashedPassword,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: unknown }).code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }

    // Generate email verification token and send welcome email
    
    const token = await this.createEmailVerification(user.id);

    await this.emailService.sendUserWelcome(
      { email: user.email, name: user.full_name },
      token,
    );

    if (process.env.NODE_ENV !== 'production') {
      return { user, verificationToken: token };
    }

    return user;
  }

  async confirmEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (!verification) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
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
      throw new BadRequestException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { email_verified: true },
      }),
    ]);

    const roles: Role[] = user.userRoles.map((ur) => ur.role.type as Role);
    const permissions = user.userRoles.flatMap((ur) => {
      const perms = ur.role.rolePermissions.map((rp) => rp.permission.code);
      if (ur.role.type === Role.User) {
        return perms.filter(
          (p) => p !== 'view_dashboard' && p !== 'manage_roles',
        );
      }
      return perms;
    });

    const tokens = await this.createAuthTokens({
      sub: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: true,
      roles,
      permissions: [...new Set(permissions)],
      tokenVersion: user.tokenVersion,
    });

    return { message: 'Email verified successfully', ...tokens };
  }

  private async createEmailVerification(userId: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

    await this.prisma.emailVerification.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findUserByEmailWithRoles(email);

    if (!user) {
      return { message: 'Verification email sent' };
    }

    if (user.email_verified) {
      return { message: 'Email already verified' };
    }

    await this.prisma.emailVerification.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const token = await this.createEmailVerification(user.id);

    try {
      await this.emailService.sendUserWelcome(
        { email: user.email, name: user.full_name },
        token,
      );
    } catch (error) {
      console.warn('Failed to send verification email', error);
    }

    return { message: 'Verification email sent' };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findUserByEmailWithRoles(email);

    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException();

    if (!user.email_verified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    await this.usersService.touchUserActivity(user.id);

    // ✅ map DB role.type → Role enum
    const roles: Role[] = user.userRoles.map((ur) => ur.role.type as Role);

    const permissions = user.userRoles.flatMap((ur) => {
      const perms = ur.role.rolePermissions.map((rp) => rp.permission.code);
      if (ur.role.type === Role.User) {
        return perms.filter(
          (p) => p !== 'view_dashboard' && p !== 'manage_roles',
        );
      }
      return perms;
    });

    return this.createAuthTokens({
      sub: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
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

    if (!user.email_verified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    const roles: Role[] = user.userRoles.map((ur) => ur.role.type as Role);
    const permissions = user.userRoles.flatMap((ur) => {
      const perms = ur.role.rolePermissions.map((rp) => rp.permission.code);
      if (ur.role.type === Role.User) {
        return perms.filter(
          (p) => p !== 'view_dashboard' && p !== 'manage_roles',
        );
      }
      return perms;
    });

    return this.createAuthTokens({
      sub: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
      roles,
      permissions: [...new Set(permissions)],
      tokenVersion: user.tokenVersion,
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

    const permissions = user.userRoles.flatMap((ur) => {
      const perms = ur.role.rolePermissions.map((rp) => rp.permission.code);
      if (ur.role.type === Role.User) {
        return perms.filter(
          (p) => p !== 'view_dashboard' && p !== 'manage_roles',
        );
      }
      return perms;
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
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

