import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @Post()
  create(@Req() req, @Body() dto) {
    return this.service.createBooking(req.user.sub, dto);
  }

  @Get('me')
  getMy(@Req() req) {
    return this.service.getMyBookings(req.user.sub);
  }

  @Patch()
  update(@Req() req, @Body() dto) {
    return this.service.updateBooking(req.user.sub, dto);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.service.deleteBooking(req.user.sub, id);
  }

  // ADMIN
  @Patch('status')
  updateStatus(@Body() dto) {
    return this.service.updateBookingStatus(dto);
  }
}
