import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Message } from './entities/message.entity';
import { ChatColorPreference } from './entities/chat-color-preference.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(ChatColorPreference)
    private chatColorPreferenceRepository: Repository<ChatColorPreference>,
  ) {}

  async create(createMessageDto: CreateMessageDto, userId: string): Promise<Message> {
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

    // If this is a reply, validate parent exists and increment its replyCount
    if (createMessageDto.parentMessageId) {
      const parentMessage = await this.messageRepository.findOne({
        where: { id: createMessageDto.parentMessageId },
      });

      if (!parentMessage) {
        throw new Error('Parent message not found');
      }

      // Increment parent's reply count
      await this.messageRepository.increment(
        { id: createMessageDto.parentMessageId },
        'replyCount',
        1,
      );
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
      parentMessageId: createMessageDto.parentMessageId,
      senderId: userId,
    });

    const saved = await this.messageRepository.save(message);
    const messageWithSender = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    if (!messageWithSender) {
      throw new Error('Failed to retrieve saved message');
    }

    return messageWithSender;
  }

  async findAllByTask(taskId: string): Promise<Message[]> {
    // Return only top-level messages (no replies)
    return this.messageRepository.find({
      where: { taskId, parentMessageId: IsNull() },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  async findThreadReplies(parentMessageId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { parentMessageId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  async findMessageById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });
  }

  async getChatColorPreference(taskId: string, userId: string): Promise<string> {
    const preference = await this.chatColorPreferenceRepository.findOne({
      where: { taskId, userId },
    });
    return preference?.color || '#4F46E5';
  }

  async setChatColorPreference(taskId: string, userId: string, color: string): Promise<ChatColorPreference> {
    let preference = await this.chatColorPreferenceRepository.findOne({
      where: { taskId, userId },
    });

    if (preference) {
      preference.color = color;
    } else {
      preference = this.chatColorPreferenceRepository.create({
        taskId,
        userId,
        color,
      });
    }

    return this.chatColorPreferenceRepository.save(preference);
  }
}
