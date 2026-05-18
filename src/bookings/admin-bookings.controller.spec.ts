import { Test, TestingModule } from '@nestjs/testing';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsService } from './bookings.service';

describe('AdminBookingsController', () => {
  let controller: AdminBookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: {
            rejectBooking: jest.fn(),
            processRejectedBookingRefunds: jest.fn(),
            deleteRejectedBooking: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminBookingsController>(AdminBookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
