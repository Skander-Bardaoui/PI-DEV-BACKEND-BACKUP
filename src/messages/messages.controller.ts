import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesGateway } from './messages.gateway';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Use process.cwd() to save to project root, not inside dist/
          const uploadPath = path.join(process.cwd(), 'uploads', 'messages');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
      },
    }),
  )
  async create(
    @Body() createMessageDto: CreateMessageDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!createMessageDto.content && !file) {
      throw new BadRequestException('Message must have content or a file');
    }

    if (file) {
      createMessageDto.fileUrl = `/uploads/messages/${file.filename}`;
      createMessageDto.fileName = file.originalname;
      createMessageDto.fileType = file.mimetype;
      createMessageDto.fileSize = file.size;
    }

    const message = await this.messagesService.create(
      createMessageDto,
      req.user.id,
    );

    console.log('📤 Message created, broadcasting to room:', `task-${createMessageDto.taskId}`);
    console.log('📤 Message ID:', message.id);

    // If this is a reply, emit newReply event
    if (createMessageDto.parentMessageId) {
      const parentMessage = await this.messagesService.findMessageById(
        createMessageDto.parentMessageId,
      );
      
      if (parentMessage) {
        this.messagesGateway.server
          .to(`task-${createMessageDto.taskId}`)
          .emit('newReply', {
            reply: message,
            parentMessageId: createMessageDto.parentMessageId,
            newReplyCount: parentMessage.replyCount + 1,
          });
        console.log('✅ Broadcasted newReply event');
      }
    } else {
      // Broadcast regular message via socket to ALL clients in the room
      this.messagesGateway.server
        .to(`task-${createMessageDto.taskId}`)
        .emit('newMessage', message);
      console.log('✅ Broadcasted newMessage event to all clients in room');
    }

    return message;
  }

  @Get('task/:taskId')
  findAllByTask(@Param('taskId') taskId: string, @Request() req) {
    return this.messagesService.findAllByTask(taskId);
  }

  @Get('thread/:parentMessageId')
  async getThread(@Param('parentMessageId') parentMessageId: string, @Request() req) {
    const parentMessage = await this.messagesService.findMessageById(parentMessageId);
    if (!parentMessage) {
      throw new BadRequestException('Parent message not found');
    }

    const replies = await this.messagesService.findThreadReplies(parentMessageId);
    
    return {
      parentMessage,
      replies,
    };
  }

  @Get('chat-color/:taskId')
  async getChatColor(@Param('taskId') taskId: string, @Request() req) {
    const color = await this.messagesService.getChatColorPreference(
      taskId,
      req.user.id,
    );
    return { color };
  }

  @Post('chat-color/:taskId')
  async setChatColor(
    @Param('taskId') taskId: string,
    @Body('color') color: string,
    @Request() req,
  ) {
    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
      throw new BadRequestException('Invalid color format. Use #RRGGBB');
    }

    const preference = await this.messagesService.setChatColorPreference(
      taskId,
      req.user.id,
      color,
    );

    return { message: 'Chat color updated', color: preference.color };
  }
}
