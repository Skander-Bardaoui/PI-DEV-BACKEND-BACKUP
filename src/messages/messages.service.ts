import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private tasksService: TasksService,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    userId: string,
  ): Promise<Message> {
    // Verify task exists and user has access
    await this.tasksService.findOne(createMessageDto.taskId, userId);

    // Ensure mentions is always an array (not a string)
    let mentions: string[] | undefined = undefined;
    if (createMessageDto.mentions) {
      if (typeof createMessageDto.mentions === 'string') {
        try {
          mentions = JSON.parse(createMessageDto.mentions);
        } catch (e) {
          mentions = undefined;
        }
      } else {
        mentions = createMessageDto.mentions;
      }
    }

    const message = this.messageRepository.create({
      taskId: createMessageDto.taskId,
      content: createMessageDto.content,
      fileUrl: createMessageDto.fileUrl,
      fileName: createMessageDto.fileName,
      fileType: createMessageDto.fileType,
      fileSize: createMessageDto.fileSize,
      mentions: mentions,
      messageColor: createMessageDto.messageColor,
      senderId: userId,
    });

    const saved = await this.messageRepository.save(message);

    // Load sender info
    const messageWithSender = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    if (!messageWithSender) {
      throw new Error('Failed to retrieve saved message');
    }

    return messageWithSender;
  }

  async findAllByTask(taskId: string, userId: string): Promise<Message[]> {
    // Verify task exists and user has access
    await this.tasksService.findOne(taskId, userId);

    return this.messageRepository.find({
      where: { taskId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }
}
