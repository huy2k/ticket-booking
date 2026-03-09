import { Module } from '@nestjs/common';
import { QueueGateway } from '../gateway/queue.gateway';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [QueueGateway],
  exports: [QueueGateway],
})
export class GatewayModule {}
