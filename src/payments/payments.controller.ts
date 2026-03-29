import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RequirePermission } from 'src/auth/decorator/permission.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { QueryPaymentDto } from './dto/query-paymnet.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @Roles(Role.Admin)
  @RequirePermission('manage_payments')
  create(@Body() dto: CreatePaymentDto) {
    return this.service.createPayment(dto);
  }

  @Patch(':id/complete')
  @Roles(Role.Admin)
  @RequirePermission('manage_payments')
  complete(@Param('id') id: string) {
    return this.service.completePayment(id);
  }

  @Post('refund')
  @Roles(Role.Admin)
  @RequirePermission('manage_payments')
  refund(@Body() dto: RefundDto) {
    return this.service.refund(dto);
  }

  @Get('stats')
  @Roles(Role.Admin)
  @RequirePermission('manage_payments')
  stats() {
    return this.service.getStats();
  }
}
