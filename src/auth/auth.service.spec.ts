import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findUserByEmailWithRoles: jest.fn(),
    createUser: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const prismaService = {
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('includes token version when logging in', async () => {
    usersService.findUserByEmailWithRoles.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      tokenVersion: 4,
      userRoles: [
        {
          role: {
            type: 'user',
            rolePermissions: [{ permission: { code: 'bookings.read' } }],
          },
        },
      ],
    });
    jwtService.signAsync.mockResolvedValue('signed-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login('user@example.com', 'plain-password'),
    ).resolves.toEqual({
      access_token: 'signed-token',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      roles: ['user'],
      permissions: ['bookings.read'],
      tokenVersion: 4,
    });
  });

  it('increments token version on logout', async () => {
    prismaService.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout('user-1')).resolves.toEqual({
      message: 'Logout successful',
    });

    expect(prismaService.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });
  });
});
