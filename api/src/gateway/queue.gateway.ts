import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/',
})
export class QueueGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map userId → socketId for targeted messages
  private userSockets = new Map<string, string>();

  constructor(private readonly redis: RedisService) {}

  handleConnection(client: Socket) {
    console.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Remove from map
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
    console.log(`WS disconnected: ${client.id}`);
  }

  /** Client registers with userId */
  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.userSockets.set(data.userId, client.id);
    client.join(`user:${data.userId}`);
    return { event: 'registered', data: { socketId: client.id } };
  }

  /** Client sends heartbeat ping */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @MessageBody() data: { userId: string; eventId: string },
  ) {
    await this.redis.heartbeatRenew(data.userId, 30);
    return { event: 'heartbeat_ack', data: { ts: Date.now() } };
  }

  /** Join event room to receive queue updates */
  @SubscribeMessage('join_event_room')
  handleJoinRoom(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`event:${data.eventId}`);
    return { event: 'room_joined', data: { eventId: data.eventId } };
  }

  // ── Server-side emit methods ───────────────────────────────────────────────

  /** Tell a specific user it's their turn to enter */
  notifyUserEnter(userId: string) {
    this.server.to(`user:${userId}`).emit('queue:enter', {
      message: 'Đến lượt bạn! Đang chuyển đến trang chọn ghế...',
      redirect: '/seat-selection',
      ts: Date.now(),
    });
  }

  /** Broadcast updated queue total to all in event room */
  broadcastQueueUpdate(eventId: string, totalInQueue: number) {
    this.server.to(`event:${eventId}`).emit('queue:update', {
      eventId,
      totalInQueue,
      ts: Date.now(),
    });
  }

  /** Broadcast when tickets are sold out */
  broadcastSoldOut(eventId: string) {
    this.server.to(`event:${eventId}`).emit('queue:sold_out', {
      eventId,
      message: 'Vé đã hết! Cảm ơn bạn đã quan tâm.',
      ts: Date.now(),
    });
  }

  /** Warn user their turn is coming soon */
  notifyUserSoon(userId: string) {
    this.server.to(`user:${userId}`).emit('queue:soon', {
      message: 'Sắp đến lượt bạn, vui lòng chuẩn bị thông tin thanh toán!',
      ts: Date.now(),
    });
  }
}
