import { Controller, Post, Get, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { QueueService } from './queue.service';

@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /** POST /api/queue/:eventId/join */
  @Post(':eventId/join')
  async join(@Param('eventId') eventId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.queueService.joinOrEnter(eventId, userId);
  }

  /** GET /api/queue/:eventId/status */
  @Get(':eventId/status')
  async status(@Param('eventId') eventId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.queueService.getStatus(eventId, userId);
  }

  /** POST /api/queue/heartbeat */
  @Post('heartbeat')
  async heartbeat(@Req() req: any) {
    const userId = req.user.id;
    await this.queueService.renewHeartbeat(userId);
    return { ok: true, ts: Date.now() };
  }
}
