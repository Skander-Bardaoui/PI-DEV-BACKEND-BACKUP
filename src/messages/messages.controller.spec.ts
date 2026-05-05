import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;
  let gateway: MessagesGateway;

  const mockMessagesService = {
    create: jest.fn(),
    findAllByTask: jest.fn(),
    findMessageById: jest.fn(),
    findThreadReplies: jest.fn(),
    getChatColorPreference: jest.fn(),
    setChatColorPreference: jest.fn(),
  };

  const mockMessagesGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: MessagesGateway,
          useValue: mockMessagesGateway,
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagesService>(MessagesService);
    gateway = module.get<MessagesGateway>(MessagesGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a message with content', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Test message',
      };

      const mockMessage = {
        id: 'message-123',
        ...createMessageDto,
        senderId: 'user-123',
        createdAt: new Date(),
      };

      mockMessagesService.create.mockResolvedValue(mockMessage);

      const result = await controller.create(createMessageDto, undefined as any, mockRequest);

      expect(service.create).toHaveBeenCalledWith(createMessageDto, 'user-123');
      expect(gateway.server.to).toHaveBeenCalledWith('task-task-123');
      expect(gateway.server.emit).toHaveBeenCalledWith('newMessage', mockMessage);
      expect(result).toEqual(mockMessage);
    });

    it('should create a message with file', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: '',
      };

      const mockFile = {
        filename: 'test-file.pdf',
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      const mockMessage = {
        id: 'message-123',
        taskId: 'task-123',
        fileUrl: '/uploads/messages/test-file.pdf',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        senderId: 'user-123',
        createdAt: new Date(),
      };

      mockMessagesService.create.mockResolvedValue(mockMessage);

      const result = await controller.create(createMessageDto, mockFile, mockRequest);

      expect(createMessageDto).toHaveProperty('fileUrl', '/uploads/messages/test-file.pdf');
      expect(createMessageDto).toHaveProperty('fileName', 'document.pdf');
      expect(createMessageDto).toHaveProperty('fileType', 'application/pdf');
      expect(createMessageDto).toHaveProperty('fileSize', 1024);
      expect(result).toEqual(mockMessage);
    });

    it('should throw BadRequestException if no content and no file', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: '',
      };

      await expect(
        controller.create(createMessageDto, undefined as any, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a reply message and emit newReply event', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Reply message',
        parentMessageId: 'parent-message-123',
      };

      const mockParentMessage = {
        id: 'parent-message-123',
        taskId: 'task-123',
        content: 'Parent message',
        replyCount: 2,
      };

      const mockReplyMessage = {
        id: 'reply-message-123',
        ...createMessageDto,
        senderId: 'user-123',
        createdAt: new Date(),
      };

      mockMessagesService.create.mockResolvedValue(mockReplyMessage);
      mockMessagesService.findMessageById.mockResolvedValue(mockParentMessage);

      const result = await controller.create(createMessageDto, undefined as any, mockRequest);

      expect(service.findMessageById).toHaveBeenCalledWith('parent-message-123');
      expect(gateway.server.to).toHaveBeenCalledWith('task-task-123');
      expect(gateway.server.emit).toHaveBeenCalledWith('newReply', {
        reply: mockReplyMessage,
        parentMessageId: 'parent-message-123',
        newReplyCount: 3,
      });
      expect(result).toEqual(mockReplyMessage);
    });

    it('should emit newMessage if parent message not found for reply', async () => {
      const createMessageDto = {
        taskId: 'task-123',
        content: 'Reply message',
        parentMessageId: 'non-existent-parent',
      };

      const mockReplyMessage = {
        id: 'reply-message-123',
        ...createMessageDto,
        senderId: 'user-123',
        createdAt: new Date(),
      };

      mockMessagesService.create.mockResolvedValue(mockReplyMessage);
      mockMessagesService.findMessageById.mockResolvedValue(null);

      const result = await controller.create(createMessageDto, undefined as any, mockRequest);

      expect(gateway.server.emit).not.toHaveBeenCalledWith('newReply', expect.any(Object));
      expect(result).toEqual(mockReplyMessage);
    });
  });

  describe('findAllByTask', () => {
    it('should return all messages for a task', async () => {
      const taskId = 'task-123';
      const mockMessages = [
        {
          id: 'message-1',
          taskId,
          content: 'Message 1',
          senderId: 'user-1',
        },
        {
          id: 'message-2',
          taskId,
          content: 'Message 2',
          senderId: 'user-2',
        },
      ];

      mockMessagesService.findAllByTask.mockResolvedValue(mockMessages);

      const result = await controller.findAllByTask(taskId, mockRequest);

      expect(service.findAllByTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockMessages);
    });
  });

  describe('getThread', () => {
    it('should return parent message and replies', async () => {
      const parentMessageId = 'parent-message-123';
      const mockParentMessage = {
        id: parentMessageId,
        taskId: 'task-123',
        content: 'Parent message',
        replyCount: 2,
      };

      const mockReplies = [
        {
          id: 'reply-1',
          parentMessageId,
          content: 'Reply 1',
        },
        {
          id: 'reply-2',
          parentMessageId,
          content: 'Reply 2',
        },
      ];

      mockMessagesService.findMessageById.mockResolvedValue(mockParentMessage);
      mockMessagesService.findThreadReplies.mockResolvedValue(mockReplies);

      const result = await controller.getThread(parentMessageId, mockRequest);

      expect(service.findMessageById).toHaveBeenCalledWith(parentMessageId);
      expect(service.findThreadReplies).toHaveBeenCalledWith(parentMessageId);
      expect(result).toEqual({
        parentMessage: mockParentMessage,
        replies: mockReplies,
      });
    });

    it('should throw BadRequestException if parent message not found', async () => {
      const parentMessageId = 'non-existent';

      mockMessagesService.findMessageById.mockResolvedValue(null);

      await expect(controller.getThread(parentMessageId, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getChatColor', () => {
    it('should return chat color preference', async () => {
      const taskId = 'task-123';
      const mockColor = '#FF5733';

      mockMessagesService.getChatColorPreference.mockResolvedValue(mockColor);

      const result = await controller.getChatColor(taskId, mockRequest);

      expect(service.getChatColorPreference).toHaveBeenCalledWith(taskId, 'user-123');
      expect(result).toEqual({ color: mockColor });
    });
  });

  describe('setChatColor', () => {
    it('should set chat color preference', async () => {
      const taskId = 'task-123';
      const color = '#FF5733';

      const mockPreference = {
        id: 'pref-123',
        taskId,
        userId: 'user-123',
        color,
      };

      mockMessagesService.setChatColorPreference.mockResolvedValue(mockPreference);

      const result = await controller.setChatColor(taskId, color, mockRequest);

      expect(service.setChatColorPreference).toHaveBeenCalledWith(
        taskId,
        'user-123',
        color,
      );
      expect(result).toEqual({
        message: 'Chat color updated',
        color: mockPreference.color,
      });
    });

    it('should throw BadRequestException for invalid color format', async () => {
      const taskId = 'task-123';
      const invalidColor = 'red';

      await expect(
        controller.setChatColor(taskId, invalidColor, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty color', async () => {
      const taskId = 'task-123';
      const emptyColor = '';

      await expect(
        controller.setChatColor(taskId, emptyColor, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid hex color formats', async () => {
      const taskId = 'task-123';
      const validColors = ['#FFFFFF', '#000000', '#ff5733', '#ABC123'];

      for (const color of validColors) {
        const mockPreference = {
          id: 'pref-123',
          taskId,
          userId: 'user-123',
          color,
        };

        mockMessagesService.setChatColorPreference.mockResolvedValue(mockPreference);

        const result = await controller.setChatColor(taskId, color, mockRequest);

        expect(result.color).toBe(color);
      }
    });
  });
});
