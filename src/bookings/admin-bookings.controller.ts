import { Body, Controller, Delete, Param, Patch, Req } from '@nestjs/common';
import { RequirePermission } from '../auth/decorator/permission.decorator';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { BookingsService } from './bookings.service';
import { AdminProcessRefundDto } from './dto/admin-process-refund.dto';
import { AdminRejectBookingBodyDto } from './dto/admin-reject-booking-body.dto';

interface JwtUser {
  sub: string;
}

@Controller('admin/bookings')
@Roles(Role.Admin, Role.Staff)
@RequirePermission(['manage_bookings'])
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Patch(':id/reject')
  reject(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: AdminRejectBookingBodyDto,
  ) {
    return this.bookingsService.rejectBooking(req.user.sub, {
      bookingId: id,
      reason: dto.reason,
      refundMode: dto.refundMode,
    });
  }

  @Patch(':id/refund')
  processRefund(@Param('id') id: string, @Body() dto: AdminProcessRefundDto) {
    return this.bookingsService.processRejectedBookingRefunds({
      bookingId: id,
      reason: dto.reason ?? 'Manual refund processing initiated by admin',
      paymentId: dto.paymentId,
      amount: dto.amount,
    });
  }

  @Delete(':id')
  deleteRejected(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.bookingsService.deleteRejectedBooking(req.user.sub, id);
  }
}
