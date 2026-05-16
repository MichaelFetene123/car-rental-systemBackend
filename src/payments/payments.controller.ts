import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorator/public.decorator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  initialize(@Body() body: InitiatePaymentDto, @Req() req: any) {
    const userId = req?.user?.sub;
    return this.paymentsService.initializePayment(userId, body?.bookingId);
  }

  @Public()
  @Get('callback')
  callback(@Query() query: any) {
    return this.paymentsService.handleCallback(query);
  }
}
