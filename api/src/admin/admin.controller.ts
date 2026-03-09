import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  @Get('users')
  async getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getUsers(Number(page) || 1, Number(limit) || 20);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { message: 'Đã xoá user' };
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  @Get('events')
  async getEvents() {
    return this.adminService.getEvents();
  }

  @Get('events/:id')
  async getEventById(@Param('id') id: string) {
    return this.adminService.getEventById(id);
  }

  @Post('events')
  async createEvent(@Body() body: any) {
    return this.adminService.createEvent(body);
  }

  @Put('events/:id')
  async updateEvent(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEvent(id, body);
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    await this.adminService.deleteEvent(id);
    return { message: 'Đã xoá event' };
  }

  // ── Tickets ────────────────────────────────────────────────────────────────
  @Get('tickets')
  async getTickets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getTickets(Number(page) || 1, Number(limit) || 20);
  }
}
