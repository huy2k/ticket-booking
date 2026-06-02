import { Controller, Get, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('my')
  async getMyTickets(@Req() req: any) {
    const userId = req.user.id;
    return this.ticketService.getMyTickets(userId);
  }

  @Get('my/:id')
  async getMyTicketDetail(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const ticket = await this.ticketService.getMyTicketDetail(userId, id);
    if (!ticket) {
      throw new NotFoundException('Không tìm thấy vé hoặc bạn không sở hữu vé này');
    }
    return ticket;
  }
}
