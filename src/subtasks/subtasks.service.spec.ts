import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SubtasksService } from './subtasks.service';
import { Subtask } from './entities/subtask.entity';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { GenerateSubtasksDto } from './dto/generate-subtasks.dto';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityType } from '../activities/entities/activity.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';

describe('SubtasksService', () => {
  let service: SubtasksService;
  let subtaskRepository: Repository<Subtask>;
  let configService: ConfigService;
  let httpService: HttpService;
  let activitiesService: ActivitiesService;

  const mockSubtaskRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockActivitiesService = {
    createActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtasksService,
        {
          provide: getRepositoryToken(Subtask),
          useValue: mockSubtaskRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    }).compile();

    service = module.get<SubtasksService>(SubtasksService);
    subtaskRepository = module.get<Repository<Subtask>>(getRepositoryToken(Subtask));
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
    activitiesService = module.get<ActivitiesService>(ActivitiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByTask', () => {
    it('should return all subtasks for a task', async () => {
      const taskId = 'task-123';
      const mockSubtasks = [
        { id: 'subtask-1', title: 'Subtask 1', taskId, order: 0 },
        { id: 'subtask-2', title: 'Subtask 2', taskId, order: 1 },
      ];

      mockSubtaskRepository.find.mockResolvedValue(mockSubtasks);

      const result = await service.findByTask(taskId);

      expect(subtaskRepository.find).toHaveBeenCalledWith({
        where: { taskId },
        order: { order: 'ASC' },
      });
      expect(result).toEqual(mockSubtasks);
    });
  });

  describe('findOne', () => {
    it('should return a subtask by id', async () => {
      const mockSubtask = {
        id: 'subtask-123',
        title: 'Test Subtask',
        taskId: 'task-123',
      };

      mockSubtaskRepository.findOne.mockResolvedValue(mockSubtask);

      const result = await service.findOne('subtask-123');

      expect(subtaskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'subtask-123' },
      });
      expect(result).toEqual(mockSubtask);
    });

    it('should return null if subtask not found', async () => {
      mockSubtaskRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTaskProgress', () => {
    it('should calculate task progress correctly', async () => {
      const taskId = 'task-123';
      const mockSubtasks = [
        { id: 'subtask-1', isCompletedByTeamMember: true },
        { id: 'subtask-2', isCompletedByTeamMember: true },
        { id: 'subtask-3', isCompletedByTeamMember: false },
        { id: 'subtask-4', isCompletedByTeamMember: false },
        { id: 'subtask-5', isCompletedByTeamMember: false },
      ];

      mockSubtaskRepository.find.mockResolvedValue(mockSubtasks);

      const result = await service.getTaskProgress(taskId);

      expect(result).toEqual({
        completed: 2,
        total: 5,
        percentage: 40,
      });
    });

    it('should return 0% for task with no subtasks', async () => {
      mockSubtaskRepository.find.mockResolvedValue([]);

      const result = await service.getTaskProgress('task-123');

      expect(result).toEqual({
        completed: 0,
        total: 0,
        percentage: 0,
      });
    });

    it('should return 100% when all subtasks completed', async () => {
      const mockSubtasks = [
        { id: 'subtask-1', isCompletedByTeamMember: true },
        { id: 'subtask-2', isCompletedByTeamMember: true },
      ];

      mockSubtaskRepository.find.mockResolvedValue(mockSubtasks);

      const result = await service.getTaskProgress('task-123');

      expect(result).toEqual({
        completed: 2,
        total: 2,
        percentage: 100,
      });
    });
  });

  describe('create', () => {
    it('should create a subtask', async () => {
      const dto: CreateSubtaskDto = {
        title: 'New Subtask',
        taskId: 'task-123',
        order: 0,
      };

      const mockSubtask = {
        id: 'subtask-123',
        ...dto,
      };

      mockSubtaskRepository.create.mockReturnValue(mockSubtask);
      mockSubtaskRepository.save.mockResolvedValue(mockSubtask);

      const result = await service.create(dto);

      expect(subtaskRepository.create).toHaveBeenCalledWith(dto);
      expect(subtaskRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSubtask);
    });
  });

  describe('update', () => {
    it('should update a subtask', async () => {
      const subtaskId = 'subtask-123';
      const dto: UpdateSubtaskDto = {
        title: 'Updated Subtask',
        isCompleted: true,
      };

      const existingSubtask = {
        id: subtaskId,
        title: 'Old Subtask',
        isCompleted: false,
      };

      const updatedSubtask = {
        ...existingSubtask,
        ...dto,
      };

      mockSubtaskRepository.findOne.mockResolvedValue(existingSubtask);
      mockSubtaskRepository.save.mockResolvedValue(updatedSubtask);

      const result = await service.update(subtaskId, dto);

      expect(subtaskRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Subtask');
      expect(result.isCompleted).toBe(true);
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockSubtaskRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('markCompleteByTeamMember', () => {
    it('should mark subtask as complete and create activity', async () => {
      const subtaskId = 'subtask-123';
      const userId = 'user-123';
      const businessId = 'business-123';

      const mockSubtask = {
        id: subtaskId,
        title: 'Test Subtask',
        taskId: 'task-123',
        isCompleted: false,
        isCompletedByTeamMember: false,
        task: {
          id: 'task-123',
          dueDate: new Date(Date.now() + 86400000), // Tomorrow
          status: 'IN_PROGRESS',
        },
      };

      const completedSubtask = {
        ...mockSubtask,
        isCompleted: true,
        isCompletedByTeamMember: true,
      };

      mockSubtaskRepository.findOne.mockResolvedValue(mockSubtask);
      mockSubtaskRepository.save.mockResolvedValue(completedSubtask);
      mockActivitiesService.createActivity.mockResolvedValue({});

      const result = await service.markCompleteByTeamMember(subtaskId, userId, businessId);

      expect(subtaskRepository.save).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
      expect(result.isCompletedByTeamMember).toBe(true);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ActivityType.SUBTASK_COMPLETED_ON_TIME,
          businessId,
          userId,
          taskId: 'task-123',
          subtaskId,
          isOnTime: true,
        }),
      );
    });

    it('should mark as overdue when task is BLOCKED', async () => {
      const mockSubtask = {
        id: 'subtask-123',
        title: 'Test Subtask',
        taskId: 'task-123',
        task: {
          id: 'task-123',
          status: 'BLOCKED',
        },
      };

      mockSubtaskRepository.findOne.mockResolvedValue(mockSubtask);
      mockSubtaskRepository.save.mockResolvedValue({
        ...mockSubtask,
        isCompleted: true,
        isCompletedByTeamMember: true,
      });
      mockActivitiesService.createActivity.mockResolvedValue({});

      await service.markCompleteByTeamMember('subtask-123', 'user-123', 'business-123');

      expect(activitiesService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ActivityType.SUBTASK_COMPLETED_OVERDUE,
          isOverdue: true,
        }),
      );
    });

    it('should mark as overdue when past due date', async () => {
      const mockSubtask = {
        id: 'subtask-123',
        title: 'Test Subtask',
        taskId: 'task-123',
        task: {
          id: 'task-123',
          dueDate: new Date(Date.now() - 86400000), // Yesterday
          status: 'IN_PROGRESS',
        },
      };

      mockSubtaskRepository.findOne.mockResolvedValue(mockSubtask);
      mockSubtaskRepository.save.mockResolvedValue({
        ...mockSubtask,
        isCompleted: true,
        isCompletedByTeamMember: true,
      });
      mockActivitiesService.createActivity.mockResolvedValue({});

      await service.markCompleteByTeamMember('subtask-123', 'user-123', 'business-123');

      expect(activitiesService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ActivityType.SUBTASK_COMPLETED_OVERDUE,
          isOverdue: true,
        }),
      );
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockSubtaskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markCompleteByTeamMember('non-existent', 'user-123', 'business-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a subtask', async () => {
      mockSubtaskRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('subtask-123');

      expect(subtaskRepository.delete).toHaveBeenCalledWith('subtask-123');
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockSubtaskRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateSubtasks', () => {
    it('should generate subtasks using AI', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Build authentication system',
        taskDescription: 'Implement user login and registration with JWT',
      };

      const mockApiResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify([
                  'Create user model',
                  'Implement registration endpoint',
                  'Implement login endpoint',
                  'Add JWT authentication',
                  'Create password hashing',
                ]),
              },
            },
          ],
        },
      };

      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.post.mockReturnValue(of(mockApiResponse));

      const result = await service.generateSubtasks(dto);

      expect(configService.get).toHaveBeenCalledWith('GROQ_API_KEY_NOUHA');
      expect(httpService.post).toHaveBeenCalled();
      expect(result).toHaveLength(5);
      expect(result[0]).toBe('Create user model');
    });

    it('should throw BadRequestException if API key missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        service.generateSubtasks({
          taskId: 'task-123',
          taskTitle: 'Test',
          taskDescription: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle AI response with markdown code blocks', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Description',
      };

      const mockApiResponse = {
        data: {
          choices: [
            {
              message: {
                content: '```json\n["Subtask 1", "Subtask 2", "Subtask 3"]\n```',
              },
            },
          ],
        },
      };

      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.post.mockReturnValue(of(mockApiResponse));

      const result = await service.generateSubtasks(dto);

      expect(result).toEqual(['Subtask 1', 'Subtask 2', 'Subtask 3']);
    });

    it('should filter out empty strings from AI response', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Description',
      };

      const mockApiResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify(['Subtask 1', '', 'Subtask 2', '   ', 'Subtask 3']),
              },
            },
          ],
        },
      };

      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.post.mockReturnValue(of(mockApiResponse));

      const result = await service.generateSubtasks(dto);

      expect(result).toEqual(['Subtask 1', 'Subtask 2', 'Subtask 3']);
    });

    it('should throw BadRequestException if AI response is not an array', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Description',
      };

      const mockApiResponse = {
        data: {
          choices: [
            {
              message: {
                content: '{"error": "Invalid response"}',
              },
            },
          ],
        },
      };

      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.post.mockReturnValue(of(mockApiResponse));

      await expect(service.generateSubtasks(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on API error', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Description',
      };

      mockConfigService.get.mockReturnValue('test-api-key');
      mockHttpService.post.mockReturnValue(
        new (class {
          subscribe(callbacks: any) {
            callbacks.error({
              response: {
                data: { error: { message: 'API error' } },
                status: 500,
              },
            });
          }
        })() as any,
      );

      await expect(service.generateSubtasks(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
