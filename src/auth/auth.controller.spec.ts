import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('logs out the authenticated user', async () => {
    authService.logout.mockResolvedValue({ message: 'Logout successful' });

    await expect(
      controller.logout({
        user: {
          sub: 'user-1',
          email: 'user@example.com',
          roles: ['user'],
          permissions: [],
          tokenVersion: 0,
        },
      }),
    ).resolves.toEqual({ message: 'Logout successful' });

    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });
});
