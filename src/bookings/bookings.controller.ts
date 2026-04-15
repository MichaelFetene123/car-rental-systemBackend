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
import { Roles } from '../auth/decorator/roles.decorator';
import { RequirePermission } from '../auth/decorator/permission.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

interface JwtUser {
  sub: string;
}
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  // ================= USER =================

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(req.user.sub, dto);
  }

  @Get('me')
  getMy(@Req() req: { user: JwtUser }) {
    return this.service.getMyBookings(req.user.sub);
  }

  @Patch()
  update(@Req() req: { user: JwtUser }, @Body() dto: UpdateBookingDto) {
    return this.service.updateBooking(req.user.sub, dto);
  }

  @Delete(':id')
  delete(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.service.deleteBooking(req.user.sub, id);
  }

  // ================= ADMIN =================

  @Patch('status')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings', 'cancel_bookings'])
  updateStatus(@Body() dto: UpdateBookingStatusDto) {
    return this.service.updateBookingStatus(dto);
  }
}
