import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: {
            createBooking: jest.fn(),
            getMyBookings: jest.fn(),
            getAllBookings: jest.fn(),
            updateBooking: jest.fn(),
            deleteBooking: jest.fn(),
            deleteExpiredBooking: jest.fn(),
            deleteCancelledBooking: jest.fn(),
            cancelBooking: jest.fn(),
            getAdminReviewQueue: jest.fn(),
            approveBooking: jest.fn(),
            rejectBooking: jest.fn(),
            markBookingPickup: jest.fn(),
            completeBooking: jest.fn(),
            markBookingNoShow: jest.fn(),
            inspectCompletedBooking: jest.fn(),
            cancelUnpaidPendingBooking: jest.fn(),
            updateBookingStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
