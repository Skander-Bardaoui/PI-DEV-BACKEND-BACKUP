import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskStatus } from './entities/task.entity';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockTasksService = {
    createTask: jest.fn(),
    getTasks: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
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
      const dto = {
        businessId: 'business-123',
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.TODO,
        assignedToId: 'user-456',
      };

      const expectedResult = {
        id: 'task-123',
        ...dto,
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTasksService.createTask.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, mockRequest);

      expect(service.createTask).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should create a task without assignee', async () => {
      const dto = {
        businessId: 'business-123',
        title: 'Unassigned Task',
        description: 'Task without assignee',
        status: TaskStatus.TODO,
      };

      const expectedResult = {
        id: 'task-124',
        ...dto,
        assignedToId: null,
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTasksService.createTask.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, mockRequest);

      expect(service.createTask).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return all tasks for a business', async () => {
      const businessId = 'business-123';
      const expectedResult = [
        {
          id: 'task-1',
          businessId,
          title: 'Task 1',
          status: TaskStatus.TODO,
        },
        {
          id: 'task-2',
          businessId,
          title: 'Task 2',
          status: TaskStatus.IN_PROGRESS,
        },
      ];

      mockTasksService.getTasks.mockResolvedValue(expectedResult);

      const result = await controller.findAll(businessId, mockRequest);

      expect(service.getTasks).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should return empty array if no tasks exist', async () => {
      const businessId = 'business-456';

      mockTasksService.getTasks.mockResolvedValue([]);

      const result = await controller.findAll(businessId, mockRequest);

      expect(service.getTasks).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const taskId = 'task-123';
      const dto = {
        title: 'Updated Task',
        status: TaskStatus.IN_PROGRESS,
      };

      const expectedResult = {
        id: taskId,
        businessId: 'business-123',
        title: 'Updated Task',
        status: TaskStatus.IN_PROGRESS,
        updatedAt: new Date(),
      };

      mockTasksService.updateTask.mockResolvedValue(expectedResult);

      const result = await controller.update(taskId, dto, mockRequest);

      expect(service.updateTask).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should update task status to DONE', async () => {
      const taskId = 'task-123';
      const dto = {
        status: TaskStatus.DONE,
      };

      const expectedResult = {
        id: taskId,
        businessId: 'business-123',
        title: 'Task',
        status: TaskStatus.DONE,
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      mockTasksService.updateTask.mockResolvedValue(expectedResult);

      const result = await controller.update(taskId, dto, mockRequest);

      expect(service.updateTask).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should update task assignee', async () => {
      const taskId = 'task-123';
      const dto = {
        assignedToId: 'user-789',
      };

      const expectedResult = {
        id: taskId,
        businessId: 'business-123',
        title: 'Task',
        assignedToId: 'user-789',
        updatedAt: new Date(),
      };

      mockTasksService.updateTask.mockResolvedValue(expectedResult);

      const result = await controller.update(taskId, dto, mockRequest);

      expect(service.updateTask).toHaveBeenCalledWith(taskId, dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      const taskId = 'task-123';
      const expectedResult = { message: 'Task deleted' };

      mockTasksService.deleteTask.mockResolvedValue(expectedResult);

      const result = await controller.remove(taskId, mockRequest);

      expect(service.deleteTask).toHaveBeenCalledWith(taskId, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });
});
