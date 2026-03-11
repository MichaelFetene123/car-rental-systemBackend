import { Test, TestingModule } from '@nestjs/testing';
import { AdminLocationsController } from './admin-locations.controller';
import { LocationsService } from '../../locations.service';

describe('AdminLocationsController', () => {
  let controller: AdminLocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminLocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: {
            getAllLocations: jest.fn(),
            createLocation: jest.fn(),
            updateLocation: jest.fn(),
            deleteLocation: jest.fn(),
            toggleStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminLocationsController>(AdminLocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
