import { Test, TestingModule } from '@nestjs/testing';
import { AdminCarCategoriesService } from './admin-car-categories.service';

describe('AdminCarCategoriesService', () => {
  let service: AdminCarCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminCarCategoriesService],
    }).compile();

    service = module.get<AdminCarCategoriesService>(AdminCarCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
