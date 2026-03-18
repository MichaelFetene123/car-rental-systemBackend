import { Test, TestingModule } from '@nestjs/testing';
import { AdminCarsService } from './admin-cars.service';

describe('AdminCarsService', () => {
  let service: AdminCarsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminCarsService],
    }).compile();

    service = module.get<AdminCarsService>(AdminCarsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
