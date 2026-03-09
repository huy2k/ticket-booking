import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { CommonModule } from '../common/common.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [CommonModule, GatewayModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
