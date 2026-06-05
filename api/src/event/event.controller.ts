import { Controller, Get, Param } from '@nestjs/common';
import { EventService } from './event.service';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async getAll() {
    return this.eventService.getEvents();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.eventService.getEventById(id);
  }
}
