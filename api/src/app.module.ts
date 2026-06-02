import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { SeatModule } from './seat/seat.module';
import { EventModule } from './event/event.module';
import { PaymentModule } from './payment/payment.module';
import { AdminModule } from './admin/admin.module';
import { TicketModule } from './ticket/ticket.module';

@Module({
  imports: [
    // Config — load .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Infrastructure
    PrismaModule,
    CommonModule,

    // WebSocket Gateway
    GatewayModule,

    // Feature modules
    AuthModule,
    QueueModule,
    SeatModule,
    EventModule,
    PaymentModule,
    AdminModule,
    TicketModule,
  ],
})
export class AppModule {}
