import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TasksService } from './tasks.service';
import { Task, TaskStatus, TaskPriority } from './entities/task.entity';
import { User } from '../users/entities/user.entity';
import { BusinessMembersService } from '../businesses/services/business-members.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from '../activities/activities.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: Repository<Task>;
  let userRepository: Repository<User>;

  const mockTaskRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    })),
  };

  const mockUserRepository = {
    find: jest.fn(),
  };

  const mockBusinessMembersService = {
    hasAccess: jest.fn(),
  };

  const mockMessagesGateway = {
    emitTaskMoved: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockActivitiesService = {
    createActivity: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback({
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        })),
        save: jest.fn((task) => Promise.resolve(task)),
      })),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: BusinessMembersService,
          useValue: mockBusinessMembersService,
        },
        {
          provide: MessagesGateway,
          useValue: mockMessagesGateway,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    taskRepository = module.get<Repository<Task>>(getRepositoryToken(Task));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task successfully', async () => {
      const dto = {
        title: 'New Task',
        description: 'Task description',
        businessId: 'business-123',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      };

      const mockTask = {
        id: 'task-123',
        ...dto,
        createdById: 'user-123',
        order: 0,
      };

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockTaskRepository.findOne.mockResolvedValue(null);
      mockTaskRepository.create.mockReturnValue(mockTask);
      mockTaskRepository.save.mockResolvedValue(mockTask);

      const result = await service.create(dto, 'user-123');

      expect(mockBusinessMembersService.hasAccess).toHaveBeenCalledWith('user-123', 'business-123');
      expect(taskRepository.create).toHaveBeenCalled();
      expect(taskRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    it('should throw BadRequestException if businessId is missing', async () => {
      const dto = {
        title: 'New Task',
        description: 'Task description',
      };

      await expect(service.create(dto as any, 'user-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const dto = {
        title: 'New Task',
        businessId: 'business-123',
      };

      mockBusinessMembersService.hasAccess.mockResolvedValue(false);

      await expect(service.create(dto as any, 'user-123')).rejects.toThrow(ForbiddenException);
    });

    it('should create task with assigned users', async () => {
      const dto = {
        title: 'New Task',
        businessId: 'business-123',
        assignedToIds: ['user-1', 'user-2'],
      };

      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com' },
        { id: 'user-2', email: 'user2@example.com' },
      ];

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockTaskRepository.findOne.mockResolvedValue(null);
      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockTaskRepository.create.mockReturnValue({ ...dto, assignedTo: mockUsers });
      mockTaskRepository.save.mockResolvedValue({ ...dto, assignedTo: mockUsers });

      const result = await service.create(dto as any, 'user-123');

      expect(userRepository.find).toHaveBeenCalled();
      expect(result.assignedTo).toEqual(mockUsers);
    });
  });

  describe('findAllByBusiness', () => {
    it('should return all tasks for a business', async () => {
      const businessId = 'business-123';
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', businessId },
        { id: 'task-2', title: 'Task 2', businessId },
      ];

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockTaskRepository.find.mockResolvedValue(mockTasks);

      const result = await service.findAllByBusiness(businessId, 'user-123');

      expect(mockBusinessMembersService.hasAccess).toHaveBeenCalledWith('user-123', businessId);
      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { businessId },
        relations: ['assignedTo', 'createdBy'],
        order: { status: 'ASC', order: 'ASC' },
      });
      expect(result).toEqual(mockTasks);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      mockBusinessMembersService.hasAccess.mockResolvedValue(false);

      await expect(service.findAllByBusiness('business-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
        title: 'Test Task',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);

      const result = await service.findOne('task-123', 'user-123');

      expect(taskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        relations: ['assignedTo', 'createdBy', 'business'],
      });
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(false);

      await expect(service.findOne('task-123', 'user-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
        title: 'Old Title',
        assignedTo: [],
      };

      const dto = {
        title: 'New Title',
        priority: TaskPriority.HIGH,
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockTaskRepository.save.mockResolvedValue({ ...mockTask, ...dto });

      const result = await service.update('task-123', dto, 'user-123');

      expect(taskRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('New Title');
      expect(result.priority).toBe(TaskPriority.HIGH);
    });

    it('should update assigned users', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
        assignedTo: [],
      };

      const mockUsers = [{ id: 'user-1' }];

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockTaskRepository.save.mockResolvedValue({ ...mockTask, assignedTo: mockUsers });

      const result = await service.update('task-123', { assignedToIds: ['user-1'] }, 'user-123');

      expect(result.assignedTo).toEqual(mockUsers);
    });
  });

  describe('remove', () => {
    it('should remove a task', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockTaskRepository.remove.mockResolvedValue(mockTask);

      await service.remove('task-123', 'user-123');

      expect(taskRepository.remove).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('moveTask', () => {
    it('should move task to new status', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
        status: TaskStatus.TODO,
        order: 0,
        priority: TaskPriority.MEDIUM,
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);

      const result = await service.moveTask(
        'task-123',
        { status: TaskStatus.IN_PROGRESS, order: 1 },
        'user-123',
      );

      expect(mockMessagesGateway.emitTaskMoved).toHaveBeenCalled();
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should create activity when moved to BLOCKED', async () => {
      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
        status: TaskStatus.TODO,
        order: 0,
        title: 'Test Task',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);

      await service.moveTask(
        'task-123',
        { status: TaskStatus.BLOCKED, order: 0 },
        'user-123',
      );

      expect(mockActivitiesService.createActivity).toHaveBeenCalled();
    });
  });

  describe('detectPriority', () => {
    it('should detect HIGH priority for urgent tasks', async () => {
      const dto = {
        title: 'Critical bug',
        description: 'Production is down',
      };

      mockConfigService.get.mockReturnValue('test-api-key');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'HIGH' } }],
        }),
      });

      const result = await service.detectPriority(dto);

      expect(result.priority).toBe(TaskPriority.HIGH);
    });

    it('should return MEDIUM as default on error', async () => {
      const dto = {
        title: 'Some task',
        description: 'Description',
      };

      mockConfigService.get.mockReturnValue('test-api-key');

      global.fetch = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await service.detectPriority(dto);

      expect(result.priority).toBe(TaskPriority.MEDIUM);
    });

    it('should throw BadRequestException if API key missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.detectPriority({ title: 'Test', description: 'Test' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('improveDescription', () => {
    it('should improve task description', async () => {
      const dto = {
        title: 'Fix bug',
        description: 'Something broken',
      };

      mockConfigService.get.mockReturnValue('test-api-key');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Investigate and fix the critical bug affecting user experience.' } }],
        }),
      });

      const result = await service.improveDescription(dto);

      expect(result.improved).toContain('Investigate');
    });

    it('should return original description on error', async () => {
      const dto = {
        title: 'Test',
        description: 'Original description',
      };

      mockConfigService.get.mockReturnValue('test-api-key');

      global.fetch = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await service.improveDescription(dto);

      expect(result.improved).toBe('Original description');
    });
  });
});
