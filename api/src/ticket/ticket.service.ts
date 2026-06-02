import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            description: true,
            location: true,
            eventDate: true,
            bannerUrl: true,
            category: true,
          },
        },
        seat: {
          select: {
            id: true,
            seatCode: true,
            row: true,
            col: true,
            category: true,
            price: true,
          },
        },
      },
      orderBy: {
        purchasedAt: 'desc',
      },
    });
  }

  async getMyTicketDetail(userId: string, ticketId: string) {
    return this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId,
      },
      include: {
        event: true,
        seat: true,
      },
    });
  }
}
