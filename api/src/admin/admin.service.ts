import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SeatStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard Stats ────────────────────────────────────────────────────────
  async getStats() {
    const [totalUsers, totalEvents, totalTickets, revenueResult] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.event.count(),
        this.prisma.ticket.count(),
        this.prisma.seat.aggregate({
          where: { status: SeatStatus.SOLD },
          _sum: { price: true },
        }),
      ]);

    return {
      totalUsers,
      totalEvents,
      totalTickets,
      totalRevenue: revenueResult._sum.price || 0,
    };
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: { select: { tickets: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page, limit };
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }

  // ── Events CRUD ────────────────────────────────────────────────────────────
  async getEvents() {
    return this.prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { seats: true, tickets: true } },
      },
    });
  }

  async createEvent(data: {
    name: string;
    description?: string;
    saleStartAt?: string;
    mapMode?: 'grid' | 'coordinate' | 'svg'; // Thêm field quy định mode
    mapConfig?: any; // Tuỳ chỉnh map config
    rows?: number;
    cols?: number;
    prices?: { vvip: number; vip: number; gold: number; silver: number };
    seatsConfig?: Array<{
      seatCode: string;
      row: string;
      col: number;
      x: number;
      y: number;
      category: string;
      price: number;
      color?: string;
    }>;
  }) {
    const isCoordinate = data.mapMode === 'coordinate';
    const isSvg = data.mapMode === 'svg';

    let totalSeats = 0;
    if (isCoordinate) {
      totalSeats = data.seatsConfig?.length || 0;
    } else if (isSvg) {
      const limits = data.mapConfig?.ticketLimits || { vvip: 20, vip: 40, gold: 60, silver: 100 };
      totalSeats = Number(limits.vvip || 0) + Number(limits.vip || 0) + Number(limits.gold || 0) + Number(limits.silver || 0);
    } else {
      totalSeats = (data.rows || 0) * (data.cols || 0);
    }

    const event = await this.prisma.event.create({
      data: {
        name: data.name,
        description: data.description,
        saleStartAt: data.saleStartAt ? new Date(data.saleStartAt) : null,
        totalSeats,
        mapConfig: data.mapConfig || null,
      },
    });

    const seatsData: any[] = [];

    if (isCoordinate && data.seatsConfig) {
      // Import từ JSON
      for (const s of data.seatsConfig) {
        seatsData.push({
          eventId: event.id,
          seatCode: s.seatCode,
          row: s.row || 'A',
          col: s.col || 1,
          x: s.x,
          y: s.y,
          color: s.color || null,
          category: s.category || 'standard',
          price: s.price,
          status: SeatStatus.AVAILABLE,
        });
      }
    } else if (isSvg && data.prices) {
      const limits = data.mapConfig?.ticketLimits || { vvip: 20, vip: 40, gold: 60, silver: 100 };
      const categories = [
        { name: 'VVIP', limit: Number(limits.vvip || 0), price: data.prices.vvip },
        { name: 'VIP', limit: Number(limits.vip || 0), price: data.prices.vip },
        { name: 'GOLD', limit: Number(limits.gold || 0), price: data.prices.gold },
        { name: 'SILVER', limit: Number(limits.silver || 0), price: data.prices.silver },
      ];

      for (const cat of categories) {
        for (let i = 1; i <= cat.limit; i++) {
          seatsData.push({
            eventId: event.id,
            seatCode: `${cat.name}-${i.toString().padStart(3, '0')}`,
            row: cat.name[0],
            col: i,
            category: cat.name,
            price: cat.price,
            status: SeatStatus.AVAILABLE,
          });
        }
      }
    } else if (data.rows && data.cols && data.prices) {
      // Tự động sinh Matrix
      const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        .slice(0, data.rows)
        .split('');
      for (let ri = 0; ri < rowLabels.length; ri++) {
        const row = rowLabels[ri];
        let category = 'SILVER';
        let price = data.prices.silver;

        const ratio = ri / rowLabels.length;
        if (ratio < 0.2) {
          category = 'VVIP';
          price = data.prices.vvip;
        } else if (ratio < 0.5) {
          category = 'VIP';
          price = data.prices.vip;
        } else if (ratio < 0.7) {
          category = 'GOLD';
          price = data.prices.gold;
        }

        for (let col = 1; col <= data.cols; col++) {
          seatsData.push({
            eventId: event.id,
            seatCode: `${row}${col.toString().padStart(2, '0')}`,
            row,
            col,
            category,
            price,
            status: SeatStatus.AVAILABLE,
          });
        }
      }
    }

    await this.prisma.seat.createMany({ data: seatsData });
    return { event, seatsCreated: seatsData.length };
  }

  async getEventById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        seats: {
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
      },
    });
  }

  async updateEvent(
    id: string,
    data: {
      name?: string;
      description?: string;
      saleStartAt?: string | null;
      mapMode?: 'grid' | 'coordinate' | 'svg';
      mapConfig?: any;
      rows?: number;
      cols?: number;
      prices?: { vvip: number; vip: number; gold: number; silver: number };
      seatsConfig?: Array<{
        seatCode: string;
        row: string;
        col: number;
        x: number;
        y: number;
        category: string;
        price: number;
        color?: string;
      }>;
    },
  ) {
    const isCoordinate = data.mapMode === 'coordinate';
    const isSvg = data.mapMode === 'svg';
    let totalSeats: number | undefined;

    if (data.mapMode) {
      if (isCoordinate) {
        totalSeats = data.seatsConfig?.length || 0;
      } else if (isSvg) {
        const limits = data.mapConfig?.ticketLimits || { vvip: 20, vip: 40, gold: 60, silver: 100 };
        totalSeats = Number(limits.vvip || 0) + Number(limits.vip || 0) + Number(limits.gold || 0) + Number(limits.silver || 0);
      } else {
        totalSeats = (data.rows || 0) * (data.cols || 0);
      }
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.saleStartAt !== undefined && {
          saleStartAt: data.saleStartAt ? new Date(data.saleStartAt) : null,
        }),
        ...(totalSeats !== undefined && { totalSeats }),
        ...(data.mapConfig !== undefined && {
          mapConfig: data.mapConfig || null,
        }),
      },
    });

    if (data.mapMode) {
      // 1. Get all existing seats for this event
      const existingSeats = await this.prisma.seat.findMany({
        where: { eventId: id },
        select: { seatCode: true, status: true },
      });
      const existingSeatCodes = new Set(existingSeats.map((s) => s.seatCode));

      const newSeatsData: any[] = [];

      if (isCoordinate && data.seatsConfig) {
        for (const s of data.seatsConfig) {
          newSeatsData.push({
            seatCode: s.seatCode,
            row: s.row || 'A',
            col: s.col || 1,
            x: s.x != null ? Number(s.x) : null,
            y: s.y != null ? Number(s.y) : null,
            color: s.color || null,
            category: s.category || 'standard',
            price: Number(s.price) || 0,
          });
        }
      } else if (isSvg && data.prices) {
        const limits = data.mapConfig?.ticketLimits || { vvip: 20, vip: 40, gold: 60, silver: 100 };
        const categories = [
          { name: 'VVIP', limit: Number(limits.vvip || 0), price: data.prices.vvip },
          { name: 'VIP', limit: Number(limits.vip || 0), price: data.prices.vip },
          { name: 'GOLD', limit: Number(limits.gold || 0), price: data.prices.gold },
          { name: 'SILVER', limit: Number(limits.silver || 0), price: data.prices.silver },
        ];

        for (const cat of categories) {
          for (let i = 1; i <= cat.limit; i++) {
            newSeatsData.push({
              seatCode: `${cat.name}-${i.toString().padStart(3, '0')}`,
              row: cat.name[0],
              col: i,
              x: null,
              y: null,
              color: null,
              category: cat.name,
              price: cat.price,
            });
          }
        }
      } else if (data.rows && data.cols && data.prices) {
        const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
          .slice(0, data.rows)
          .split('');
        for (let ri = 0; ri < rowLabels.length; ri++) {
          const row = rowLabels[ri];
          let category = 'SILVER';
          let price = data.prices.silver;

          const ratio = ri / rowLabels.length;
          if (ratio < 0.2) {
            category = 'VVIP';
            price = data.prices.vvip;
          } else if (ratio < 0.5) {
            category = 'VIP';
            price = data.prices.vip;
          } else if (ratio < 0.7) {
            category = 'GOLD';
            price = data.prices.gold;
          }

          for (let col = 1; col <= data.cols; col++) {
            newSeatsData.push({
              seatCode: `${row}${col.toString().padStart(2, '0')}`,
              row,
              col,
              x: null,
              y: null,
              color: null,
              category,
              price,
            });
          }
        }
      }

      const newSeatCodes = new Set(newSeatsData.map((s) => s.seatCode));

      // Items to delete (exists in db, not in new config, and is AVAILABLE)
      const seatCodesToDelete = existingSeats
        .filter(
          (s) =>
            !newSeatCodes.has(s.seatCode) && s.status === SeatStatus.AVAILABLE,
        )
        .map((s) => s.seatCode);

      const operations: any[] = [];

      if (seatCodesToDelete.length > 0) {
        operations.push(
          this.prisma.seat.deleteMany({
            where: { eventId: id, seatCode: { in: seatCodesToDelete } },
          }),
        );
      }

      for (const seat of newSeatsData) {
        if (existingSeatCodes.has(seat.seatCode)) {
          operations.push(
            this.prisma.seat.update({
              where: {
                eventId_seatCode: { eventId: id, seatCode: seat.seatCode },
              },
              data: {
                row: seat.row.toString(),
                col: Number(seat.col),
                x: seat.x,
                y: seat.y,
                color: seat.color,
                category: seat.category,
                price: seat.price,
              },
            }),
          );
        } else {
          operations.push(
            this.prisma.seat.create({
              data: {
                eventId: id,
                status: SeatStatus.AVAILABLE,
                seatCode: seat.seatCode,
                row: seat.row.toString(),
                col: Number(seat.col),
                x: seat.x,
                y: seat.y,
                color: seat.color,
                category: seat.category,
                price: seat.price,
              },
            }),
          );
        }
      }

      if (operations.length > 0) {
        await this.prisma.$transaction(operations);
      }
    }

    return updatedEvent;
  }

  async deleteEvent(id: string) {
    // Cascade: delete tickets → seats → event
    await this.prisma.ticket.deleteMany({ where: { eventId: id } });
    await this.prisma.seat.deleteMany({ where: { eventId: id } });
    await this.prisma.event.delete({ where: { id } });
  }

  // ── Tickets ────────────────────────────────────────────────────────────────
  async getTickets(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        skip,
        take: limit,
        orderBy: { purchasedAt: 'desc' },
        include: {
          user: { select: { email: true, phone: true } },
          event: { select: { name: true } },
          seat: { select: { seatCode: true, category: true, price: true } },
        },
      }),
      this.prisma.ticket.count(),
    ]);
    return { tickets, total, page, limit };
  }
}
