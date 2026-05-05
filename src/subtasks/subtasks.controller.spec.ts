import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubtasksController } from './subtasks.controller';
import { SubtasksService } from './subtasks.service';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { GenerateSubtasksDto } from './dto/generate-subtasks.dto';
import { Role } from '../users/enums/role.enum';
import { ForbiddenException } from '@nestjs/common';

describe('SubtasksController', () => {
  let controller: SubtasksController;
  let service: SubtasksService;
  let businessMemberRepository: Repository<BusinessMember>;
  let taskRepository: Repository<Task>;

  const mockSubtasksService = {
    findByTask: jest.fn(),
    getTaskProgress: jest.fn(),
    create: jest.fn(),
    generateSubtasks: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    markCompleteByTeamMember: jest.fn(),
    remove: jest.fn(),
  };

  const mockBusinessMemberRepository = {
    findOne: jest.fn(),
  };

  const mockTaskRepository = {
    findOne: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubtasksController],
      providers: [
        {
          provide: SubtasksService,
          useValue: mockSubtasksService,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockBusinessMemberRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
      ],
    }).compile();

    controller = module.get<SubtasksController>(SubtasksController);
    service = module.get<SubtasksService>(SubtasksService);
    businessMemberRepository = module.get<Repository<BusinessMember>>(
      getRepositoryToken(BusinessMember),
    );
    taskRepository = module.get<Repository<Task>>(getRepositoryToken(Task));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByTask', () => {
    it('should return all subtasks for a task', async () => {
      const taskId = 'task-123';
      const mockSubtasks = [
        { id: 'subtask-1', title: 'Subtask 1', taskId },
        { id: 'subtask-2', title: 'Subtask 2', taskId },
      ];

      mockSubtasksService.findByTask.mockResolvedValue(mockSubtasks);

      const result = await controller.findByTask(taskId);

      expect(service.findByTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockSubtasks);
    });
  });

  describe('getTaskProgress', () => {
    it('should return task progress', async () => {
      const taskId = 'task-123';
      const mockProgress = {
        completed: 3,
        total: 5,
        percentage: 60,
      };

      mockSubtasksService.getTaskProgress.mockResolvedValue(mockProgress);

      const result = await controller.getTaskProgress(taskId);

      expect(service.getTaskProgress).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockProgress);
    });
  });

  describe('create', () => {
    it('should create a subtask with BUSINESS_OWNER permission', async () => {
      const dto: CreateSubtaskDto = {
        title: 'New Subtask',
        taskId: 'task-123',
        order: 0,
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.BUSINESS_OWNER,
        is_active: true,
      };

      const mockSubtask = {
        id: 'subtask-123',
        ...dto,
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.create.mockResolvedValue(mockSubtask);

      const result = await controller.create(dto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockSubtask);
    });

    it('should create a subtask with create_subtask permission', async () => {
      const dto: CreateSubtaskDto = {
        title: 'New Subtask',
        taskId: 'task-123',
        order: 0,
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.BUSINESS_ADMIN,
        is_active: true,
        collaboration_permissions: {
          create_subtask: true,
        },
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.create.mockResolvedValue({ id: 'subtask-123', ...dto });

      const result = await controller.create(dto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should throw ForbiddenException without permission', async () => {
      const dto: CreateSubtaskDto = {
        title: 'New Subtask',
        taskId: 'task-123',
        order: 0,
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {
          create_subtask: false,
        },
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);

      await expect(controller.create(dto, mockRequest)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateSubtasks', () => {
    it('should generate subtasks using AI', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Build authentication system',
        taskDescription: 'Implement user login and registration',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.BUSINESS_OWNER,
        is_active: true,
      };

      const mockGeneratedSubtasks = [
        'Create user model',
        'Implement registration endpoint',
        'Implement login endpoint',
        'Add JWT authentication',
        'Create password hashing',
      ];

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.generateSubtasks.mockResolvedValue(mockGeneratedSubtasks);

      const result = await controller.generateSubtasks(dto, mockRequest);

      expect(service.generateSubtasks).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockGeneratedSubtasks);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw ForbiddenException without create_subtask permission', async () => {
      const dto: GenerateSubtasksDto = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Description',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {},
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);

      await expect(controller.generateSubtasks(dto, mockRequest)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update a subtask', async () => {
      const subtaskId = 'subtask-123';
      const dto: UpdateSubtaskDto = {
        title: 'Updated Subtask',
        isCompleted: true,
      };

      const mockSubtask = {
        id: subtaskId,
        taskId: 'task-123',
        title: 'Old Title',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.BUSINESS_OWNER,
        is_active: true,
      };

      mockSubtasksService.findOne.mockResolvedValue(mockSubtask);
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.update.mockResolvedValue({ ...mockSubtask, ...dto });

      const result = await controller.update(subtaskId, dto, mockRequest);

      expect(service.update).toHaveBeenCalledWith(subtaskId, dto);
      expect(result.title).toBe('Updated Subtask');
    });
  });

  describe('markCompleteByTeamMember', () => {
    it('should mark subtask as complete by team member', async () => {
      const subtaskId = 'subtask-123';
      const body = { businessId: 'business-123' };

      const mockSubtask = {
        id: subtaskId,
        taskId: 'task-123',
        title: 'Test Subtask',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {
          mark_complete_subtask: true,
        },
      };

      const mockCompletedSubtask = {
        ...mockSubtask,
        isCompleted: true,
        isCompletedByTeamMember: true,
      };

      mockSubtasksService.findOne.mockResolvedValue(mockSubtask);
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.markCompleteByTeamMember.mockResolvedValue(mockCompletedSubtask);

      const result = await controller.markCompleteByTeamMember(subtaskId, body, mockRequest);

      expect(service.markCompleteByTeamMember).toHaveBeenCalledWith(
        subtaskId,
        'user-123',
        'business-123',
      );
      expect(result.isCompleted).toBe(true);
      expect(result.isCompletedByTeamMember).toBe(true);
    });

    it('should throw ForbiddenException without mark_complete_subtask permission', async () => {
      const subtaskId = 'subtask-123';
      const body = { businessId: 'business-123' };

      const mockSubtask = {
        id: subtaskId,
        taskId: 'task-123',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {},
      };

      mockSubtasksService.findOne.mockResolvedValue(mockSubtask);
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);

      await expect(
        controller.markCompleteByTeamMember(subtaskId, body, mockRequest),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete a subtask', async () => {
      const subtaskId = 'subtask-123';

      const mockSubtask = {
        id: subtaskId,
        taskId: 'task-123',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.BUSINESS_OWNER,
        is_active: true,
      };

      mockSubtasksService.findOne.mockResolvedValue(mockSubtask);
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);
      mockSubtasksService.remove.mockResolvedValue(undefined);

      await controller.remove(subtaskId, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(subtaskId);
    });

    it('should throw ForbiddenException without delete_subtask permission', async () => {
      const subtaskId = 'subtask-123';

      const mockSubtask = {
        id: subtaskId,
        taskId: 'task-123',
      };

      const mockTask = {
        id: 'task-123',
        businessId: 'business-123',
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        role: Role.ACCOUNTANT,
        is_active: true,
        collaboration_permissions: {},
      };

      mockSubtasksService.findOne.mockResolvedValue(mockSubtask);
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMember);

      await expect(controller.remove(subtaskId, mockRequest)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('testGroq', () => {
    it('should return Groq API test information', async () => {
      const result = await controller.testGroq();

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('hasApiKey');
    });
  });
});
