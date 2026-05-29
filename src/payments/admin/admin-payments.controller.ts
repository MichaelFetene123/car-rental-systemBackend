import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/decorator/permission.decorator';
import { Roles } from '../../auth/decorator/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPaymentQueryDto } from '../dto/admin-payment-query.dto';
import { AdminUpdatePaymentStatusDto } from '../dto/admin-update-payment-status.dto';
import { AdminProcessPaymentRefundDto } from '../dto/admin-process-payment-refund.dto';

interface JwtUser {
  sub: string;
}

@Controller('admin/payments')
@Roles(Role.Admin, Role.Staff)
@RequirePermission(['manage_bookings'])
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Get()
  findAll(@Query() query: AdminPaymentQueryDto) {
    return this.adminPaymentsService.findAll(query);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePaymentStatusDto,
  ) {
    return this.adminPaymentsService.updateStatus(id, dto);
  }

  @Post(':id/refund')
  processRefund(
    @Param('id') id: string,
    @Body() dto: AdminProcessPaymentRefundDto,
    @Req() req: { user: JwtUser },
  ) {
    return this.adminPaymentsService.processRefund(id, dto, req.user.sub);
  }
}
