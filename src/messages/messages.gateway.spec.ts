import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { Socket } from 'socket.io';

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let service: MessagesService;

  const mockMessagesService = {
    create: jest.fn(),
    findAllByTask: jest.fn(),
    findMessageById: jest.fn(),
  };

  const mockSocket = {
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    id: 'socket-123',
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    service = module.get<MessagesService>(MessagesService);
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleJoinTask', () => {
    it('should join a task room', () => {
      const taskId = 'task-123';

      const result = gateway.handleJoinTask(taskId, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('task-task-123');
      expect(result).toEqual({
        event: 'joinedTask',
        data: taskId,
      });
    });

    it('should handle multiple task joins', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      taskIds.forEach((taskId) => {
        gateway.handleJoinTask(taskId, mockSocket);
      });

      expect(mockSocket.join).toHaveBeenCalledTimes(3);
      expect(mockSocket.join).toHaveBeenCalledWith('task-task-1');
      expect(mockSocket.join).toHaveBeenCalledWith('task-task-2');
      expect(mockSocket.join).toHaveBeenCalledWith('task-task-3');
    });
  });

  describe('handleLeaveTask', () => {
    it('should leave a task room', () => {
      const taskId = 'task-123';

      const result = gateway.handleLeaveTask(taskId, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('task-task-123');
      expect(result).toEqual({
        event: 'leftTask',
        data: taskId,
      });
    });
  });

  describe('handleMessage', () => {
    it('should create and broadcast a message', async () => {
      const messageData = {
        taskId: 'task-123',
        content: 'Test message',
        userId: 'user-123',
      };

      const mockMessage = {
        id: 'message-123',
        taskId: messageData.taskId,
        content: messageData.content,
        senderId: messageData.userId,
        createdAt: new Date(),
      };

      mockMessagesService.create.mockResolvedValue(mockMessage);

      const result = await gateway.handleMessage(messageData, mockSocket);

      expect(service.create).toHaveBeenCalledWith(
        {
          taskId: messageData.taskId,
          content: messageData.content,
        },
        messageData.userId,
      );
      expect(mockServer.to).toHaveBeenCalledWith('task-task-123');
      expect(mockServer.emit).toHaveBeenCalledWith('newMessage', mockMessage);
      expect(result).toEqual({
        event: 'messageSent',
        data: mockMessage,
      });
    });

    it('should handle errors when creating message', async () => {
      const messageData = {
        taskId: 'task-123',
        content: 'Test message',
        userId: 'user-123',
      };

      const errorMessage = 'Failed to create message';
      mockMessagesService.create.mockRejectedValue(new Error(errorMessage));

      const result = await gateway.handleMessage(messageData, mockSocket);

      expect(result).toEqual({
        event: 'error',
        data: errorMessage,
      });
    });

    it('should handle unknown errors', async () => {
      const messageData = {
        taskId: 'task-123',
        content: 'Test message',
        userId: 'user-123',
      };

      mockMessagesService.create.mockRejectedValue('Unknown error');

      const result = await gateway.handleMessage(messageData, mockSocket);

      expect(result).toEqual({
        event: 'error',
        data: 'Unknown error occurred',
      });
    });
  });

  describe('handleUserTyping', () => {
    it('should broadcast typing status to other users in task room', () => {
      const typingData = {
        taskId: 'task-123',
        userId: 'user-123',
        userName: 'John Doe',
        isTyping: true,
      };

      const result = gateway.handleUserTyping(typingData, mockSocket);

      expect(mockSocket.to).toHaveBeenCalledWith('task-task-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('userTyping', {
        userId: typingData.userId,
        userName: typingData.userName,
        isTyping: typingData.isTyping,
      });
      expect(result).toEqual({
        event: 'typingBroadcasted',
        data: true,
      });
    });

    it('should broadcast when user stops typing', () => {
      const typingData = {
        taskId: 'task-123',
        userId: 'user-123',
        userName: 'John Doe',
        isTyping: false,
      };

      gateway.handleUserTyping(typingData, mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('userTyping', {
        userId: typingData.userId,
        userName: typingData.userName,
        isTyping: false,
      });
    });
  });

  describe('emitTaskMoved', () => {
    it('should emit task moved event to business room', () => {
      const businessId = 'business-123';
      const taskMovedData = {
        taskId: 'task-123',
        newStatus: 'IN_PROGRESS',
        newOrder: 2,
        movedBy: 'user-123',
      };

      gateway.emitTaskMoved(businessId, taskMovedData);

      expect(mockServer.to).toHaveBeenCalledWith('business-business-123');
      expect(mockServer.emit).toHaveBeenCalledWith('taskMoved', taskMovedData);
    });

    it('should handle multiple task moves', () => {
      const businessId = 'business-123';
      const taskMoves = [
        {
          taskId: 'task-1',
          newStatus: 'IN_PROGRESS',
          newOrder: 1,
          movedBy: 'user-123',
        },
        {
          taskId: 'task-2',
          newStatus: 'DONE',
          newOrder: 3,
          movedBy: 'user-456',
        },
      ];

      taskMoves.forEach((taskMove) => {
        gateway.emitTaskMoved(businessId, taskMove);
      });

      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleJoinBusiness', () => {
    it('should join a business room', () => {
      const businessId = 'business-123';

      const result = gateway.handleJoinBusiness(businessId, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('business-business-123');
      expect(result).toEqual({
        event: 'joinedBusiness',
        data: businessId,
      });
    });
  });

  describe('handleLeaveBusiness', () => {
    it('should leave a business room', () => {
      const businessId = 'business-123';

      const result = gateway.handleLeaveBusiness(businessId, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('business-business-123');
      expect(result).toEqual({
        event: 'leftBusiness',
        data: businessId,
      });
    });
  });

  describe('Room management', () => {
    it('should handle joining and leaving multiple rooms', () => {
      const taskId = 'task-123';
      const businessId = 'business-123';

      // Join rooms
      gateway.handleJoinTask(taskId, mockSocket);
      gateway.handleJoinBusiness(businessId, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('task-task-123');
      expect(mockSocket.join).toHaveBeenCalledWith('business-business-123');

      // Leave rooms
      gateway.handleLeaveTask(taskId, mockSocket);
      gateway.handleLeaveBusiness(businessId, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('task-task-123');
      expect(mockSocket.leave).toHaveBeenCalledWith('business-business-123');
    });
  });

  describe('Message broadcasting', () => {
    it('should broadcast messages only to task room members', async () => {
      const messageData = {
        taskId: 'task-123',
        content: 'Test message',
        userId: 'user-123',
      };

      const mockMessage = {
        id: 'message-123',
        ...messageData,
        senderId: messageData.userId,
      };

      mockMessagesService.create.mockResolvedValue(mockMessage);

      await gateway.handleMessage(messageData, mockSocket);

      expect(mockServer.to).toHaveBeenCalledWith('task-task-123');
      expect(mockServer.emit).toHaveBeenCalledWith('newMessage', mockMessage);
    });

    it('should not broadcast typing to sender', () => {
      const typingData = {
        taskId: 'task-123',
        userId: 'user-123',
        userName: 'John Doe',
        isTyping: true,
      };

      gateway.handleUserTyping(typingData, mockSocket);

      // Should use socket.to() which excludes the sender
      expect(mockSocket.to).toHaveBeenCalledWith('task-task-123');
    });
  });
});
