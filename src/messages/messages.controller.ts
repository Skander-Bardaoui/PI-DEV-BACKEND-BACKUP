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
          const uploadPath = './public/uploads/messages';
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

    // Broadcast via socket
    this.messagesGateway.server
      .to(`task-${createMessageDto.taskId}`)
      .emit('newMessage', message);

    return message;
  }

  @Get('task/:taskId')
  findAllByTask(@Param('taskId') taskId: string, @Request() req) {
    return this.messagesService.findAllByTask(taskId, req.user.id);
  }
}
