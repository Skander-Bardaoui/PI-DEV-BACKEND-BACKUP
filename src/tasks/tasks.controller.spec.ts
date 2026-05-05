import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { DetectPriorityDto } from './dto/detect-priority.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';
import { TaskStatus, TaskPriority } from './entities/task.entity';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockTasksService = {
    create: jest.fn(),
    findAllByBusiness: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    moveTask: jest.fn(),
    detectPriority: jest.fn(),
    improveDescription: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a task', async () => {
      const dto: CreateTaskDto = {
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

      mockTasksService.create.mockResolvedValue(mockTask);

      const result = await controller.create(dto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual(mockTask);
    });
  });

  describe('findAllByBusiness', () => {
    it('should return all tasks for a business', async () => {
      const businessId = 'business-123';
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          businessId,
          status: TaskStatus.TODO,
        },
        {
          id: 'task-2',
          title: 'Task 2',
          businessId,
          status: TaskStatus.IN_PROGRESS,
        },
      ];

      mockTasksService.findAllByBusiness.mockResolvedValue(mockTasks);

      const result = await controller.findAllByBusiness(businessId, mockRequest);

      expect(service.findAllByBusiness).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual(mockTasks);
    });
  });

  describe('findOne', () => {
    it('should return a single task', async () => {
      const taskId = 'task-123';
      const mockTask = {
        id: taskId,
        title: 'Test Task',
        businessId: 'business-123',
      };

      mockTasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne(taskId, mockRequest);

      expect(service.findOne).toHaveBeenCalledWith(taskId, 'user-123');
      expect(result).toEqual(mockTask);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const taskId = 'task-123';
      const dto: UpdateTaskDto = {
        title: 'Updated Task',
        priority: TaskPriority.HIGH,
      };

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Task',
        priority: TaskPriority.HIGH,
      };

      mockTasksService.update.mockResolvedValue(mockUpdatedTask);

      const result = await controller.update(taskId, dto, mockRequest);

      expect(service.update).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result).toEqual(mockUpdatedTask);
    });
  });

  describe('moveTask', () => {
    it('should move a task to a new status and order', async () => {
      const taskId = 'task-123';
      const dto: MoveTaskDto = {
        status: TaskStatus.IN_PROGRESS,
        order: 2,
      };

      const mockMovedTask = {
        id: taskId,
        status: TaskStatus.IN_PROGRESS,
        order: 2,
      };

      mockTasksService.moveTask.mockResolvedValue(mockMovedTask);

      const result = await controller.moveTask(taskId, dto, mockRequest);

      expect(service.moveTask).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result).toEqual(mockMovedTask);
    });

    it('should move a task with priority update', async () => {
      const taskId = 'task-123';
      const dto: MoveTaskDto = {
        status: TaskStatus.DONE,
        order: 0,
        priority: TaskPriority.LOW,
      };

      const mockMovedTask = {
        id: taskId,
        status: TaskStatus.DONE,
        order: 0,
        priority: TaskPriority.LOW,
      };

      mockTasksService.moveTask.mockResolvedValue(mockMovedTask);

      const result = await controller.moveTask(taskId, dto, mockRequest);

      expect(service.moveTask).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result.priority).toBe(TaskPriority.LOW);
    });
  });

  describe('detectPriority', () => {
    it('should detect task priority using AI', async () => {
      const dto: DetectPriorityDto = {
        title: 'Critical bug fix',
        description: 'Production is down, needs immediate attention',
      };

      const mockResponse = { priority: TaskPriority.HIGH };

      mockTasksService.detectPriority.mockResolvedValue(mockResponse);

      const result = await controller.detectPriority(dto);

      expect(service.detectPriority).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
      expect(result.priority).toBe(TaskPriority.HIGH);
    });

    it('should detect low priority for routine tasks', async () => {
      const dto: DetectPriorityDto = {
        title: 'Update documentation',
        description: 'Add comments to the README file',
      };

      const mockResponse = { priority: TaskPriority.LOW };

      mockTasksService.detectPriority.mockResolvedValue(mockResponse);

      const result = await controller.detectPriority(dto);

      expect(result.priority).toBe(TaskPriority.LOW);
    });
  });

  describe('improveDescription', () => {
    it('should improve task description using AI', async () => {
      const dto: ImproveDescriptionDto = {
        title: 'Fix bug',
        description: 'Something is broken',
      };

      const mockResponse = {
        improved: 'Investigate and resolve the critical bug affecting user login functionality. Ensure proper error handling and add unit tests.',
      };

      mockTasksService.improveDescription.mockResolvedValue(mockResponse);

      const result = await controller.improveDescription(dto);

      expect(service.improveDescription).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
      expect(result.improved).toContain('Investigate');
    });

    it('should improve description without title', async () => {
      const dto: ImproveDescriptionDto = {
        description: 'Need to do something',
      };

      const mockResponse = {
        improved: 'Complete the assigned task with proper documentation and testing.',
      };

      mockTasksService.improveDescription.mockResolvedValue(mockResponse);

      const result = await controller.improveDescription(dto);

      expect(service.improveDescription).toHaveBeenCalledWith(dto);
      expect(result.improved).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      const taskId = 'task-123';

      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove(taskId, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(taskId, 'user-123');
    });
  });
});
