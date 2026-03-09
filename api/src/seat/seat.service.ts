import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SeatStatus } from '@prisma/client';

@Injectable()
export class SeatService {
  private readonly LOCK_MINUTES: number;

  constructor(private readonly prisma: PrismaService) {
    this.LOCK_MINUTES = parseInt(process.env.SEAT_LOCK_MINUTES || '10', 10);
  }

  /** Get all seats for an event with current status */
  async getSeatMap(eventId: string) {
    const seats = await this.prisma.seat.findMany({
      where: { eventId },
      select: {
        id: true,
        seatCode: true,
        row: true,
        col: true,
        x: true,
        y: true,
        color: true,
        category: true,
        price: true,
        status: true,
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { mapConfig: true },
    });

    return { seats, mapConfig: event?.mapConfig || null };
  }

  /**
   * Lock a seat for a user using SELECT FOR UPDATE to prevent overselling.
   * Only one concurrent transaction will succeed.
   */
  async lockSeat(seatId: string, userId: string, bookingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Raw lock query — only one transaction can hold this lock
      const [seat] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          locked_by: string | null;
          lock_booking_id: string | null;
          locked_until: Date | null;
        }>
      >`
        SELECT id, status, locked_by as "locked_by", lock_booking_id as "lock_booking_id", locked_until as "locked_until"
        FROM seats
        WHERE id = ${seatId}
        FOR UPDATE NOWAIT
      `;

      if (!seat) {
        throw new NotFoundException('Ghế không tồn tại');
      }

      // Check if seat is available or expired lock
      const now = new Date();
      const isExpired =
        seat.status === 'PENDING' &&
        seat.locked_until &&
        seat.locked_until < now;

      if (seat.status === 'SOLD') {
        throw new ConflictException('Ghế này đã được bán');
      }

      if (seat.status === 'PENDING' && !isExpired) {
        if (seat.locked_by === userId && seat.lock_booking_id === bookingId) {
          // Same user with same booking re-locks — refresh timer
        } else {
          throw new ConflictException('Ghế này đang được người khác hoặc phiên mua vè khác giữ');
        }
      }

      // Lock the seat
      const lockedUntil = new Date(
        now.getTime() + this.LOCK_MINUTES * 60 * 1000,
      );
      await tx.seat.update({
        where: { id: seatId },
        data: {
          status: SeatStatus.PENDING,
          lockedBy: userId,
          lockBookingId: bookingId,
          lockedUntil,
        },
      });
    });
  }

  /**
   * Release a seat (timeout or user cancelled)
   */
  async releaseSeat(seatId: string): Promise<void> {
    await this.prisma.seat.updateMany({
      where: {
        id: seatId,
        status: SeatStatus.PENDING,
      },
      data: {
        status: SeatStatus.AVAILABLE,
        lockedBy: null,
        lockBookingId: null,
        lockedUntil: null,
      },
    });
  }

  /**
   * Confirm purchase — mark seat as SOLD and create ticket
   */
  async confirmPurchase(
    seatId: string,
    userId: string,
    bookingId: string,
    paymentRef: string,
    buyerInfo?: { buyerName: string; buyerEmail: string; buyerPhone: string },
  ): Promise<{ ticketId: string }> {
    return await this.prisma.$transaction(async (tx) => {
      const seat = await tx.seat.findUnique({ where: { id: seatId } });

      if (!seat) throw new NotFoundException('Ghế không tồn tại');
      if (seat.status !== SeatStatus.PENDING) {
        throw new BadRequestException('Ghế chưa được giữ chỗ');
      }
      if (seat.lockedBy !== userId || seat.lockBookingId !== bookingId) {
        throw new ConflictException('Bạn không có quyền thanh toán ghế này');
      }

      // Mark as SOLD
      await tx.seat.update({
        where: { id: seatId },
        data: {
          status: SeatStatus.SOLD,
          lockedBy: null,
          lockBookingId: null,
          lockedUntil: null,
        },
      });

      // Create ticket
      const ticket = await tx.ticket.create({
        data: {
          userId,
          seatId,
          eventId: seat.eventId,
          paymentRef,
          buyerName: buyerInfo?.buyerName || '',
          buyerEmail: buyerInfo?.buyerEmail || '',
          buyerPhone: buyerInfo?.buyerPhone || '',
        },
      });

      return { ticketId: ticket.id };
    });
  }

  /**
   * Cron job: release all PENDING seats past their lock expiry
   */
  async releaseExpiredSeats(): Promise<number> {
    const result = await this.prisma.seat.updateMany({
      where: {
        status: SeatStatus.PENDING,
        lockedUntil: { lt: new Date() },
      },
      data: {
        status: SeatStatus.AVAILABLE,
        lockedBy: null,
        lockBookingId: null,
        lockedUntil: null,
      },
    });
    return result.count;
  }
}
