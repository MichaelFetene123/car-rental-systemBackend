import { Test, TestingModule } from '@nestjs/testing';
import { AdminLocationsController } from './admin-locations.controller';

describe('AdminLocationsController', () => {
  let controller: AdminLocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminLocationsController],
    }).compile();

    controller = module.get<AdminLocationsController>(AdminLocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
