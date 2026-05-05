import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MessagesService } from './messages.service';
import { Message } from './entities/message.entity';
import { ChatColorPreference } from './entities/chat-color-preference.entity';

describe('MessagesService', () => {
  let service: MessagesService;
  let messageRepo: Repository<Message>;
  let chatColorPreferenceRepo: Repository<ChatColorPreference>;

  const mockMessageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    increment: jest.fn(),
  };

  const mockChatColorPreferenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(ChatColorPreference),
          useValue: mockChatColorPreferenceRepository,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    messageRepo = module.get<Repository<Message>>(getRepositoryToken(Message));
    chatColorPreferenceRepo = module.get<Repository<ChatColorPreference>>(
      getRepositoryToken(ChatColorPreference),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a message with content', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Test message',
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        taskId: createMessageDto.taskId,
        content: createMessageDto.content,
        senderId: userId,
        createdAt: new Date(),
      };

      const mockMessageWithSender = {
        ...mockMessage,
        sender: {
          id: userId,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
        },
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(mockMessageWithSender);

      const result = await service.create(createMessageDto, userId);

      expect(messageRepo.create).toHaveBeenCalledWith({
        taskId: createMessageDto.taskId,
        content: createMessageDto.content,
        fileUrl: undefined,
        fileName: undefined,
        fileType: undefined,
        fileSize: undefined,
        mentions: undefined,
        messageColor: undefined,
        parentMessageId: undefined,
        senderId: userId,
      });
      expect(messageRepo.save).toHaveBeenCalled();
      expect(messageRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockMessage.id },
        relations: ['sender'],
      });
      expect(result).toEqual(mockMessageWithSender);
    });

    it('should create a message with file attachments', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Message with file',
        fileUrl: '/uploads/messages/file.pdf',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        ...createMessageDto,
        senderId: userId,
      };

      const mockMessageWithSender = {
        ...mockMessage,
        sender: { id: userId, email: 'test@example.com' },
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(mockMessageWithSender);

      const result = await service.create(createMessageDto, userId);

      expect(result.fileUrl).toBe('/uploads/messages/file.pdf');
      expect(result.fileName).toBe('document.pdf');
      expect(result.fileType).toBe('application/pdf');
      expect(result.fileSize).toBe(2048);
    });

    it('should parse mentions from JSON string', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Message with mentions',
        mentions: '["user-1", "user-2"]',
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        taskId: createMessageDto.taskId,
        content: createMessageDto.content,
        mentions: ['user-1', 'user-2'],
        senderId: userId,
      };

      const mockMessageWithSender = {
        ...mockMessage,
        sender: { id: userId, email: 'test@example.com' },
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(mockMessageWithSender);

      const result = await service.create(createMessageDto, userId);

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: ['user-1', 'user-2'],
        }),
      );
    });

    it('should handle mentions as array', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Message with mentions',
        mentions: ['user-1', 'user-2'],
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        taskId: createMessageDto.taskId,
        content: createMessageDto.content,
        mentions: ['user-1', 'user-2'],
        senderId: userId,
      };

      const mockMessageWithSender = {
        ...mockMessage,
        sender: { id: userId, email: 'test@example.com' },
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(mockMessageWithSender);

      const result = await service.create(createMessageDto, userId);

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: ['user-1', 'user-2'],
        }),
      );
    });

    it('should handle invalid JSON mentions gracefully', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Message with invalid mentions',
        mentions: 'invalid-json',
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        taskId: createMessageDto.taskId,
        content: createMessageDto.content,
        mentions: undefined,
        senderId: userId,
      };

      const mockMessageWithSender = {
        ...mockMessage,
        sender: { id: userId, email: 'test@example.com' },
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(mockMessageWithSender);

      const result = await service.create(createMessageDto, userId);

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: undefined,
        }),
      );
    });

    it('should create a reply and increment parent replyCount', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Reply message',
        parentMessageId: 'parent-message-123',
      };

      const userId = 'user-123';

      const mockParentMessage = {
        id: 'parent-message-123',
        taskId: 'task-123',
        content: 'Parent message',
        replyCount: 2,
      };

      const mockReplyMessage = {
        id: 'reply-message-123',
        ...createMessageDto,
        senderId: userId,
      };

      const mockReplyWithSender = {
        ...mockReplyMessage,
        sender: { id: userId, email: 'test@example.com' },
      };

      mockMessageRepository.findOne
        .mockResolvedValueOnce(mockParentMessage)
        .mockResolvedValueOnce(mockReplyWithSender);
      mockMessageRepository.create.mockReturnValue(mockReplyMessage);
      mockMessageRepository.save.mockResolvedValue(mockReplyMessage);
      mockMessageRepository.increment.mockResolvedValue(undefined);

      const result = await service.create(createMessageDto, userId);

      expect(messageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'parent-message-123' },
      });
      expect(messageRepo.increment).toHaveBeenCalledWith(
        { id: 'parent-message-123' },
        'replyCount',
        1,
      );
      expect(result).toEqual(mockReplyWithSender);
    });

    it('should throw error if parent message not found', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Reply message',
        parentMessageId: 'non-existent-parent',
      };

      const userId = 'user-123';

      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createMessageDto, userId)).rejects.toThrow(
        'Parent message not found',
      );
    });

    it('should throw error if saved message cannot be retrieved', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Test message',
      };

      const userId = 'user-123';

      const mockMessage = {
        id: 'message-123',
        ...createMessageDto,
        senderId: userId,
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createMessageDto, userId)).rejects.toThrow(
        'Failed to retrieve saved message',
      );
    });
  });

  describe('findAllByTask', () => {
    it('should return all top-level messages for a task', async () => {
      const taskId = 'task-123';

      const mockMessages = [
        {
          id: 'message-1',
          taskId,
          content: 'Message 1',
          parentMessageId: null,
          sender: { id: 'user-1', email: 'user1@example.com' },
        },
        {
          id: 'message-2',
          taskId,
          content: 'Message 2',
          parentMessageId: null,
          sender: { id: 'user-2', email: 'user2@example.com' },
        },
      ];

      mockMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.findAllByTask(taskId);

      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { taskId, parentMessageId: IsNull() },
        relations: ['sender'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockMessages);
    });

    it('should not return reply messages', async () => {
      const taskId = 'task-123';

      const mockMessages = [
        {
          id: 'message-1',
          taskId,
          content: 'Top-level message',
          parentMessageId: null,
        },
      ];

      mockMessageRepository.find.mockResolvedValue(mockMessages);

      const result = await service.findAllByTask(taskId);

      expect(result).toHaveLength(1);
      expect(result[0].parentMessageId).toBeNull();
    });
  });

  describe('findThreadReplies', () => {
    it('should return all replies for a parent message', async () => {
      const parentMessageId = 'parent-message-123';

      const mockReplies = [
        {
          id: 'reply-1',
          parentMessageId,
          content: 'Reply 1',
          sender: { id: 'user-1', email: 'user1@example.com' },
        },
        {
          id: 'reply-2',
          parentMessageId,
          content: 'Reply 2',
          sender: { id: 'user-2', email: 'user2@example.com' },
        },
      ];

      mockMessageRepository.find.mockResolvedValue(mockReplies);

      const result = await service.findThreadReplies(parentMessageId);

      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { parentMessageId },
        relations: ['sender'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockReplies);
    });
  });

  describe('findMessageById', () => {
    it('should return a message by id', async () => {
      const messageId = 'message-123';

      const mockMessage = {
        id: messageId,
        taskId: 'task-123',
        content: 'Test message',
        sender: { id: 'user-123', email: 'test@example.com' },
      };

      mockMessageRepository.findOne.mockResolvedValue(mockMessage);

      const result = await service.findMessageById(messageId);

      expect(messageRepo.findOne).toHaveBeenCalledWith({
        where: { id: messageId },
        relations: ['sender'],
      });
      expect(result).toEqual(mockMessage);
    });

    it('should return null if message not found', async () => {
      const messageId = 'non-existent';

      mockMessageRepository.findOne.mockResolvedValue(null);

      const result = await service.findMessageById(messageId);

      expect(result).toBeNull();
    });
  });

  describe('getChatColorPreference', () => {
    it('should return user chat color preference', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';

      const mockPreference = {
        id: 'pref-123',
        taskId,
        userId,
        color: '#FF5733',
      };

      mockChatColorPreferenceRepository.findOne.mockResolvedValue(mockPreference);

      const result = await service.getChatColorPreference(taskId, userId);

      expect(chatColorPreferenceRepo.findOne).toHaveBeenCalledWith({
        where: { taskId, userId },
      });
      expect(result).toBe('#FF5733');
    });

    it('should return default color if no preference found', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';

      mockChatColorPreferenceRepository.findOne.mockResolvedValue(null);

      const result = await service.getChatColorPreference(taskId, userId);

      expect(result).toBe('#4F46E5');
    });
  });

  describe('setChatColorPreference', () => {
    it('should update existing color preference', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';
      const newColor = '#FF5733';

      const existingPreference = {
        id: 'pref-123',
        taskId,
        userId,
        color: '#4F46E5',
      };

      const updatedPreference = {
        ...existingPreference,
        color: newColor,
      };

      mockChatColorPreferenceRepository.findOne.mockResolvedValue(existingPreference);
      mockChatColorPreferenceRepository.save.mockResolvedValue(updatedPreference);

      const result = await service.setChatColorPreference(taskId, userId, newColor);

      expect(chatColorPreferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          color: newColor,
        }),
      );
      expect(result.color).toBe(newColor);
    });

    it('should create new color preference if none exists', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';
      const color = '#FF5733';

      const newPreference = {
        id: 'pref-123',
        taskId,
        userId,
        color,
      };

      mockChatColorPreferenceRepository.findOne.mockResolvedValue(null);
      mockChatColorPreferenceRepository.create.mockReturnValue(newPreference);
      mockChatColorPreferenceRepository.save.mockResolvedValue(newPreference);

      const result = await service.setChatColorPreference(taskId, userId, color);

      expect(chatColorPreferenceRepo.create).toHaveBeenCalledWith({
        taskId,
        userId,
        color,
      });
      expect(chatColorPreferenceRepo.save).toHaveBeenCalled();
      expect(result).toEqual(newPreference);
    });
  });
});
