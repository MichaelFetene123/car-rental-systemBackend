import { Test, TestingModule } from '@nestjs/testing';
import { CarCategoriesService } from './car-categories.service';

describe('CarCategoriesService', () => {
  let service: CarCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CarCategoriesService],
    }).compile();

    service = module.get<CarCategoriesService>(CarCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
