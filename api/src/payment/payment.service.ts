import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import { SeatService } from '../seat/seat.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private seatService: SeatService,
  ) {}

  async createPaymentUrl(userId: string, bookingId: string, seatIds: string[], amount: number, ipAddr: string, buyerInfo: { buyerName: string; buyerEmail: string; buyerPhone: string }): Promise<string> {
    const tmnCode = this.configService.get<string>('VNP_TMNCODE');
    const secretKey = this.configService.get<string>('VNP_HASHSECRET');
    let vnpUrl = this.configService.get<string>('VNP_URL');
    const returnUrl = this.configService.get<string>('VNP_RETURN_URL');

    if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
      throw new Error('VNPay config missing');
    }

    const date = new Date();
    const createDate = this.formatDate(date);
    const txnRef = date.getTime().toString(); // Random order id

    // Store temporary order info in Redis (TTL 10 minutes)
    await this.redisService.set(`vnp_order:${txnRef}`, JSON.stringify({ userId, bookingId, seatIds, buyerInfo }), 600);

    const vnp_Params: Record<string, string | number> = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = txnRef;
    vnp_Params['vnp_OrderInfo'] = `Thanh toan ve TicketZone cho ma don ${txnRef}`;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;

    // Sort params
    const sortedParams = this.sortObject(vnp_Params);
    
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(signData).digest('hex'); 
    
    sortedParams['vnp_SecureHash'] = signed;
    vnpUrl += '?' + new URLSearchParams(sortedParams as any).toString();

    return vnpUrl;
  }

  async verifyReturnUrl(query: any): Promise<any> {
    const vnp_Params = { ...query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnp_Params);
    const secretKey = this.configService.get<string>('VNP_HASHSECRET');

    if (!secretKey) throw new Error('VNPay secret missing');

    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(signData).digest('hex');     

    if (secureHash === signed) {
      const rspCode = vnp_Params['vnp_ResponseCode'];
      const txnRef = vnp_Params['vnp_TxnRef'];
      
      const orderDataStr = await this.redisService.get(`vnp_order:${txnRef}`);
      
      if (!orderDataStr) {
        return { RspCode: '99', Message: 'Order not found in Redis (timeout or invalid)' };
      }

      const orderData = JSON.parse(orderDataStr);

      if (rspCode === '00') {
         // Thanh toán thành công -> Confirm purchase
         try {
           for(const seatId of orderData.seatIds) {
               await this.seatService.confirmPurchase(seatId, orderData.userId, orderData.bookingId, txnRef, orderData.buyerInfo);
           }
           await this.redisService.remove(`vnp_order:${txnRef}`);
           return { RspCode: '00', Message: 'Success', tickets: orderData.seatIds };
         } catch(e) {
             this.logger.error('Failed to confirm tickets', e);
             return { RspCode: '99', Message: 'Failed to generate tickets' };
         }
      } else {
         // Thanh toán thất bại hoặc hủy -> Release seats
         for(const seatId of orderData.seatIds) {
             await this.seatService.releaseSeat(seatId);
         }
         await this.redisService.remove(`vnp_order:${txnRef}`);
         return { RspCode: '01', Message: 'Payment failed' };
      }
    } else {
      return { RspCode: '97', Message: 'Invalid checksum' };
    }
  }

  private sortObject(obj: Record<string, any>) {
    const sorted: Record<string, any> = {};
    const str: string[] = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  }

  private formatDate(date: Date) {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const sec = date.getSeconds().toString().padStart(2, '0');
    return yyyy + mm + dd + hh + min + sec;
  }
}
