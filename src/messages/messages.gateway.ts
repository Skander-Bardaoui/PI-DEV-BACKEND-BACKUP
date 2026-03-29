import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messagesService: MessagesService) {}

  @SubscribeMessage('joinTask')
  handleJoinTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`task-${taskId}`);
    return { event: 'joinedTask', data: taskId };
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
}
