import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorator/permission.decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { BookingsService } from './bookings.service';
import { AdminApproveBookingDto } from './dto/admin-approve-booking.dto';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto';
import { AdminCompleteBookingDto } from './dto/admin-complete-booking.dto';
import { AdminInspectBookingDto } from './dto/admin-inspect-booking.dto';
import { AdminNoShowBookingDto } from './dto/admin-no-show-booking.dto';
import { AdminPickupBookingDto } from './dto/admin-pickup-booking.dto';
import { AdminRejectBookingDto } from './dto/admin-reject-booking.dto';
import { AdminReviewQueueDto } from './dto/admin-review-queue.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

interface JwtUser {
  sub: string;
}

@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(req.user.sub, dto);
  }

  @Get('me')
  getMy(@Req() req: { user: JwtUser }) {
    return this.service.getMyBookings(req.user.sub);
  }

  @Get()
  @Roles(Role.Admin)
  @RequirePermission(['view_bookings'])
  getAll() {
    return this.service.getAllBookings();
  }

  @Patch()
  update(@Req() req: { user: JwtUser }, @Body() dto: UpdateBookingDto) {
    return this.service.updateBooking(req.user.sub, dto);
  }

  @Delete(':id')
  delete(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto?: CancelBookingDto,
  ) {
    return this.service.deleteBooking(req.user.sub, id, dto);
  }

  @Delete('admin/:id/expired')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  deleteExpired(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.service.deleteExpiredBooking(req.user.sub, id);
  }

  @Delete('admin/:id/cancelled')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  deleteCancelled(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.service.deleteCancelledBooking(req.user.sub, id);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.service.cancelBooking(req.user.sub, id, dto);
  }

  @Get('admin/review-queue')
  @Roles(Role.Admin)
  @RequirePermission(['view_bookings'])
  getReviewQueue(@Query() query: AdminReviewQueueDto) {
    return this.service.getAdminReviewQueue(query);
  }

  @Patch('admin/approve')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  approve(@Req() req: { user: JwtUser }, @Body() dto: AdminApproveBookingDto) {
    return this.service.approveBooking(req.user.sub, dto);
  }

  @Patch('admin/reject')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  reject(@Req() req: { user: JwtUser }, @Body() dto: AdminRejectBookingDto) {
    return this.service.rejectBooking(req.user.sub, dto);
  }

  @Patch('admin/pickup')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  pickup(@Req() req: { user: JwtUser }, @Body() dto: AdminPickupBookingDto) {
    return this.service.markBookingPickup(req.user.sub, dto);
  }

  @Patch('admin/complete')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  complete(
    @Req() req: { user: JwtUser },
    @Body() dto: AdminCompleteBookingDto,
  ) {
    return this.service.completeBooking(req.user.sub, dto);
  }

  @Patch('admin/no-show')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  noShow(@Req() req: { user: JwtUser }, @Body() dto: AdminNoShowBookingDto) {
    return this.service.markBookingNoShow(req.user.sub, dto);
  }

  @Patch('admin/inspection')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  inspect(@Req() req: { user: JwtUser }, @Body() dto: AdminInspectBookingDto) {
    return this.service.inspectCompletedBooking(req.user.sub, dto);
  }

  @Patch('admin/cancel-unpaid')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  cancelUnpaid(
    @Req() req: { user: JwtUser },
    @Body() dto: AdminCancelBookingDto,
  ) {
    return this.service.cancelUnpaidPendingBooking(req.user.sub, dto);
  }

  @Patch('status')
  @Roles(Role.Admin)
  @RequirePermission(['manage_bookings'])
  updateStatus(
    @Req() req: { user: JwtUser },
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.service.updateBookingStatus(req.user.sub, dto);
  }
}
