import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface UserPresence {
  userId: string;
  businessId: string;
  status: 'online' | 'offline';
  lastSeen: Date;
  socketId: string;
}

@WebSocketGateway({
  namespace: '/presence',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
@Injectable()
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map to track user presence: userId -> UserPresence
  private userPresence = new Map<string, UserPresence>();
  
  // Map to track socket to user: socketId -> userId
  private socketToUser = new Map<string, string>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from cookies (HTTP-only cookie named 'access_token')
      const cookies = client.handshake.headers.cookie;
      let token: string | undefined;
      
      if (cookies) {
        // Try 'access_token' first, then 'token' as fallback
        const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
        const tokenMatch = cookies.match(/token=([^;]+)/);
        token = accessTokenMatch ? accessTokenMatch[1] : (tokenMatch ? tokenMatch[1] : undefined);
      }
      
      // Fallback to auth.token or authorization header
      if (!token) {
        token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      }
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Verify JWT token (secret is configured in PresenceModule)
      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;
      const businessId = client.handshake.query.businessId as string;

      if (!userId || !businessId) {
        client.disconnect();
        return;
      }

      // Store user presence
      this.userPresence.set(userId, {
        userId,
        businessId,
        status: 'online',
        lastSeen: new Date(),
        socketId: client.id,
      });

      this.socketToUser.set(client.id, userId);

      // Join business room
      client.join(`presence:${businessId}`);

      // Broadcast user online status to business room
      this.server.to(`presence:${businessId}`).emit('userStatusChanged', {
        userId,
        status: 'online',
        timestamp: new Date(),
      });

      // Send current online users to the newly connected client
      const onlineUsers = this.getOnlineUsersForBusiness(businessId);
      client.emit('onlineUsers', onlineUsers);

    } catch (error) {
      console.error('Presence connection error:', error instanceof Error ? error.message : 'Unknown error');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    
    if (userId) {
      const presence = this.userPresence.get(userId);
      
      if (presence) {
        // Update status to offline
        presence.status = 'offline';
        presence.lastSeen = new Date();

        // Broadcast user offline status
        this.server.to(`presence:${presence.businessId}`).emit('userStatusChanged', {
          userId,
          status: 'offline',
          lastSeen: presence.lastSeen,
        });

        // Clean up
        this.userPresence.delete(userId);
      }

      this.socketToUser.delete(client.id);
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = this.socketToUser.get(client.id);
    
    if (userId) {
      const presence = this.userPresence.get(userId);
      if (presence) {
        presence.lastSeen = new Date();
      }
    }

    return { status: 'ok' };
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { businessId: string },
  ) {
    const onlineUsers = this.getOnlineUsersForBusiness(data.businessId);
    return { onlineUsers };
  }

  private getOnlineUsersForBusiness(businessId: string): string[] {
    const onlineUsers: string[] = [];
    
    this.userPresence.forEach((presence) => {
      if (presence.businessId === businessId && presence.status === 'online') {
        onlineUsers.push(presence.userId);
      }
    });

    return onlineUsers;
  }

  // Method to get user status (can be called from other services)
  getUserStatus(userId: string): 'online' | 'offline' {
    const presence = this.userPresence.get(userId);
    return presence?.status || 'offline';
  }

  // Method to get all online users for a business (can be called from other services)
  getBusinessOnlineUsers(businessId: string): UserPresence[] {
    const users: UserPresence[] = [];
    
    this.userPresence.forEach((presence) => {
      if (presence.businessId === businessId && presence.status === 'online') {
        users.push(presence);
      }
    });

    return users;
  }
}
