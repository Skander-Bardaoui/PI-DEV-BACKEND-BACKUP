import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: ['http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
})
export class MessagesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messagesService: MessagesService) {}

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
      
      // If token is present, we could validate it here and attach user info to socket
      // For now, we allow connections without tokens since user identity is passed in event payloads
      
      console.log(`✅ Client ${client.id} connected${token ? ' (authenticated)' : ' (no token)'}`);
    } catch (error) {
      console.error('Connection error:', error instanceof Error ? error.message : 'Unknown error');
      // Don't disconnect on error - allow connection to proceed
      console.log(`✅ Client ${client.id} connected (error during auth check, allowing anyway)`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client ${client.id} disconnected`);
  }

  @SubscribeMessage('joinTask')
  handleJoinTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('=== joinTask RECEIVED ===');
    console.log('taskId value:', taskId);
    console.log('taskId type:', typeof taskId);
    console.log('client.id:', client.id);
    console.log('client.connected:', client.connected);
    
    try {
      const roomName = `task-${taskId}`;
      console.log('Joining room:', roomName);
      client.join(roomName);
      console.log('Successfully joined room:', roomName);
      console.log('Client rooms:', Array.from(client.rooms));
      client.emit('joinedTask', taskId);
      console.log('=== joinTask COMPLETE ===');
    } catch (error) {
      console.error('=== joinTask ERROR ===', error);
    }
  }

  @SubscribeMessage('leaveTask')
  handleLeaveTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`task-${taskId}`);
    return { event: 'leftTask', data: taskId };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { taskId: string; content: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const createMessageDto: CreateMessageDto = {
        taskId: data.taskId,
        content: data.content,
      };

      const message = await this.messagesService.create(
        createMessageDto,
        data.userId,
      );

      // Emit to all clients in the task room
      this.server.to(`task-${data.taskId}`).emit('newMessage', message);

      return { event: 'messageSent', data: message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { event: 'error', data: errorMessage };
    }
  }

  @SubscribeMessage('userTyping')
  handleUserTyping(
    @MessageBody() data: { taskId: string; userId: string; userName: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('📝 Backend received userTyping event:', {
      taskId: data.taskId,
      userId: data.userId,
      userName: data.userName,
      isTyping: data.isTyping,
    });
    
    // Broadcast to everyone in the room EXCEPT the sender
    client.to(`task-${data.taskId}`).emit('userTyping', {
      userId: data.userId,
      userName: data.userName,
      isTyping: data.isTyping,
    });
    
    console.log('✅ Broadcasted userTyping to other clients in task room:', `task-${data.taskId}`);
    
    return { event: 'typingBroadcasted', data: true };
  }

  // Emit task moved event to all clients in the business
  emitTaskMoved(businessId: string, data: {
    taskId: string;
    newStatus: string;
    newOrder: number;
    movedBy: string;
  }) {
    this.server.to(`business-${businessId}`).emit('taskMoved', data);
  }

  @SubscribeMessage('joinBusiness')
  handleJoinBusiness(
    @MessageBody() businessId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`business-${businessId}`);
    return { event: 'joinedBusiness', data: businessId };
  }

  @SubscribeMessage('leaveBusiness')
  handleLeaveBusiness(
    @MessageBody() businessId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`business-${businessId}`);
    return { event: 'leftBusiness', data: businessId };
  }
}
