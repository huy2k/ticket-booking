import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async getEvents() {
    return this.prisma.event.findMany({
      orderBy: { saleStartAt: 'asc' },
    });
  }

  async getEventById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }
}
