import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('exception', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const secret = process.env.JWT_SECRET || 'medcore_jwt_super_secret_key_2026_change_in_production';
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || !payload.userId) {
        client.emit('exception', { message: 'Invalid token payload' });
        client.disconnect(true);
        return;
      }

      // Store authenticated identity strictly from verified server-side JWT
      client.data.user = {
        userId: payload.userId,
        role: payload.role,
        hospitalId: payload.hospitalId,
      };

      // Automatically join user-specific room
      client.join(`user_${payload.userId}`);

      // Automatically join own hospital room if affiliated
      if (payload.hospitalId) {
        client.join(`hospital_${payload.hospitalId}`);
      }
    } catch (err) {
      client.emit('exception', { message: 'Invalid or expired authentication token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // Cleaned up automatically by Socket.io
  }

  @SubscribeMessage('join_hospital')
  handleJoinHospital(client: Socket, targetHospitalId: string) {
    const user = client.data?.user;
    if (!user) {
      return { event: 'error', message: 'Unauthorized socket session' };
    }

    // Role & Tenant isolation check
    if (user.role === 'SUPER_ADMIN' || user.hospitalId === targetHospitalId) {
      client.join(`hospital_${targetHospitalId}`);
      return { event: 'joined', room: `hospital_${targetHospitalId}` };
    }

    return {
      event: 'error',
      message: `Forbidden: User from hospital ${user.hospitalId || 'NONE'} cannot join hospital ${targetHospitalId}`,
    };
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('notification:new', notification);
  }

  sendNotificationToHospital(hospitalId: string, notification: any) {
    this.server.to(`hospital_${hospitalId}`).emit('notification:new', notification);
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken.startsWith('Bearer ') ? authToken.substring(7) : authToken;
    }

    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken.startsWith('Bearer ') ? queryToken.substring(7) : queryToken;
    }

    return null;
  }
}
