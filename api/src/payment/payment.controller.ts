import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create_url')
  async createUrl(
    @Body() body: { seatIds: string[]; bookingId: string; amount: number; buyerName: string; buyerEmail: string; buyerPhone: string },
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const buyerInfo = { buyerName: body.buyerName, buyerEmail: body.buyerEmail, buyerPhone: body.buyerPhone };
    
    const url = await this.paymentService.createPaymentUrl(userId, body.bookingId, body.seatIds, body.amount, ipAddr as string, buyerInfo);
    return { url };
  }

  @Get('vnpay_verify')
  async vnpayReturn(@Query() query: any) {
    return this.paymentService.verifyReturnUrl(query);
  }
}
