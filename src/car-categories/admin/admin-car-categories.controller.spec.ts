import { Test, TestingModule } from '@nestjs/testing';
import { AdminCarCategoriesController } from './admin-car-categories.controller';

describe('AdminCarCategoriesController', () => {
  let controller: AdminCarCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCarCategoriesController],
    }).compile();

    controller = module.get<AdminCarCategoriesController>(AdminCarCategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
