import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { PrismaService } from 'src/prisma.service';

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: PrismaService,
          useValue: {
            location: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
