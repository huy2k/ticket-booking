import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { SeatService } from './seat.service';
import { IsString } from 'class-validator';

class LockSeatDto {
  @IsString()
  seatId: string;

  @IsString()
  bookingId: string;
}

class ConfirmPurchaseDto {
  @IsString()
  seatId: string;

  @IsString()
  bookingId: string;

  @IsString()
  paymentRef: string;
}

@Controller('seats')
@UseGuards(JwtAuthGuard)
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  /** GET /api/seats/:eventId/map */
  @Get(':eventId/map')
  getSeatMap(@Param('eventId') eventId: string) {
    return this.seatService.getSeatMap(eventId);
  }

  /** POST /api/seats/lock */
  @Post('lock')
  lockSeat(@Body() dto: LockSeatDto, @Req() req: any) {
    return this.seatService.lockSeat(dto.seatId, req.user.id, dto.bookingId);
  }

  /** PATCH /api/seats/release/:seatId */
  @Patch('release/:seatId')
  releaseSeat(@Param('seatId') seatId: string) {
    return this.seatService.releaseSeat(seatId);
  }

  /** POST /api/seats/confirm */
  @Post('confirm')
  confirmPurchase(@Body() dto: ConfirmPurchaseDto, @Req() req: any) {
    return this.seatService.confirmPurchase(
      dto.seatId,
      req.user.id,
      dto.bookingId,
      dto.paymentRef,
    );
  }
}
