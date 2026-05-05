import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Accept payment
  @Post('initialize')
  initialize(@Body() body: { bookingId: string }, @Req() req: any) {
    const userId = req?.user?.sub;
    // console.log('[payments] initialize user id:', userId);
    return this.paymentsService.initializePayment(userId, body.bookingId);
  }

  // Verify manually (fallback)
  @Get('verify')
  verify(@Query('tx_ref') txRef: string) {
    return this.paymentsService.verifyPayment(txRef);
  }

  // Callback (redirect)
  @Get('callback')
  callback(@Query() query: any) {
    return this.paymentsService.handleCallback(query);
  }

  // Webhook (primary)
  @Post('webhook')
  webhook(@Body() body: any, @Headers() headers: any, @Req() req: any) {
    return this.paymentsService.handleWebhook(body, headers, req.rawBody);
  }
}
