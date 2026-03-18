import { Test, TestingModule } from '@nestjs/testing';
import { AdminCarsController } from './admin-cars.controller';

describe('AdminCarsController', () => {
  let controller: AdminCarsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCarsController],
    }).compile();

    controller = module.get<AdminCarsController>(AdminCarsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
