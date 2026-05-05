import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './entities/task.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Role } from '../users/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionUtil } from '../businesses/utils/permission.util';

jest.mock('../businesses/utils/permission.util');

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: Repository<Task>;
  let memberRepo: Repository<BusinessMember>;

  const mockTaskRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockMemberRepository = {
    findOne: jest.fn(),
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
          provide: getRepositoryToken(BusinessMember),
          useValue: mockMemberRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    memberRepo = module.get<Repository<BusinessMember>>(getRepositoryToken(BusinessMember));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hasAccess', () => {
    it('should return true if user is an active member', async () => {
      const mockMember = {
        user_id: 'user-123',
        business_id: 'business-123',
        is_active: true,
      };

      mockMemberRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.hasAccess('user-123', 'business-123');

      expect(result).toBe(true);
      expect(memberRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: 'user-123', business_id: 'business-123', is_active: true },
      });
    });

    it('should return false if user is not a member', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.hasAccess('user-123', 'business-123');

      expect(result).toBe(false);
    });
  });

  describe('createTask', () => {
    const dto = {
      businessId: 'business-123',
      title: 'Test Task',
      description: 'Test Description',
      status: TaskStatus.TODO,
      assignedToId: 'user-456',
    };

    const mockMember = {
      user_id: 'user-123',
      business_id: 'business-123',
      role: Role.BUSINESS_ADMIN,
      is_active: true,
      collaboration_permissions: { create_task: true },
      user: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
    };

    it('should create a task successfully with proper permissions', async () => {
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(true);

      const mockTask = {
        id: 'task-123',
        ...dto,
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTaskRepository.create.mockReturnValue(mockTask);
      mockTaskRepository.save.mockResolvedValue(mockTask);

      const result = await service.createTask(dto, 'user-123');

      expect(result).toEqual(mockTask);
      expect(taskRepo.create).toHaveBeenCalledWith({
        ...dto,
        createdById: 'user-123',
      });
      expect(taskRepo.save).toHaveBeenCalledWith(mockTask);
    });

    it('should allow BUSINESS_OWNER to create task without checking permissions', async () => {
      const ownerMember = {
        ...mockMember,
        role: Role.BUSINESS_OWNER,
      };

      mockMemberRepository.findOne.mockResolvedValue(ownerMember);

      const mockTask = {
        id: 'task-123',
        ...dto,
        createdById: 'user-123',
      };

      mockTaskRepository.create.mockReturnValue(mockTask);
      mockTaskRepository.save.mockResolvedValue(mockTask);

      const result = await service.createTask(dto, 'user-123');

      expect(result).toEqual(mockTask);
      expect(PermissionUtil.hasGranularPermission).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.createTask(dto, 'user-123')).rejects.toThrow(
        new ForbiddenException('Not a member of this business'),
      );
    });

    it('should throw ForbiddenException if user lacks create_task permission', async () => {
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(false);

      await expect(service.createTask(dto, 'user-123')).rejects.toThrow(
        new ForbiddenException('You do not have permission to create tasks'),
      );
    });
  });

  describe('getTasks', () => {
    const businessId = 'business-123';
    const userId = 'user-123';

    const mockMember = {
      user_id: userId,
      business_id: businessId,
      role: Role.TEAM_MEMBER,
      is_active: true,
      user: { id: userId, firstName: 'John', lastName: 'Doe' },
    };

    it('should return all tasks for a business', async () => {
      mockMemberRepository.findOne.mockResolvedValue(mockMember);

      const mockTasks = [
        {
          id: 'task-1',
          businessId,
          title: 'Task 1',
          status: TaskStatus.TODO,
          createdAt: new Date(),
        },
        {
          id: 'task-2',
          businessId,
          title: 'Task 2',
          status: TaskStatus.IN_PROGRESS,
          createdAt: new Date(),
        },
      ];

      mockTaskRepository.find.mockResolvedValue(mockTasks);

      const result = await service.getTasks(businessId, userId);

      expect(result).toEqual(mockTasks);
      expect(taskRepo.find).toHaveBeenCalledWith({
        where: { businessId },
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.getTasks(businessId, userId)).rejects.toThrow(
        new ForbiddenException('Not a member of this business'),
      );
    });
  });

  describe('updateTask', () => {
    const taskId = 'task-123';
    const dto = {
      title: 'Updated Task',
      status: TaskStatus.IN_PROGRESS,
    };

    const mockTask = {
      id: taskId,
      businessId: 'business-123',
      title: 'Original Task',
      status: TaskStatus.TODO,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMember = {
      user_id: 'user-123',
      business_id: 'business-123',
      role: Role.BUSINESS_ADMIN,
      is_active: true,
      collaboration_permissions: { update_task: true },
      user: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
    };

    it('should update a task successfully', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(true);

      const updatedTask = { ...mockTask, ...dto };
      mockTaskRepository.save.mockResolvedValue(updatedTask);

      const result = await service.updateTask(taskId, dto, 'user-123');

      expect(result).toEqual(updatedTask);
      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('should set completedAt when status is DONE', async () => {
      const doneDto = { status: TaskStatus.DONE };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(true);

      const updatedTask = { ...mockTask, status: TaskStatus.DONE, completedAt: expect.any(Date) };
      mockTaskRepository.save.mockResolvedValue(updatedTask);

      const result = await service.updateTask(taskId, doneDto, 'user-123');

      expect(result.completedAt).toBeDefined();
    });

    it('should throw NotFoundException if task does not exist', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.updateTask(taskId, dto, 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks update_task permission', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(false);

      await expect(service.updateTask(taskId, dto, 'user-123')).rejects.toThrow(
        new ForbiddenException('You do not have permission to update tasks'),
      );
    });

    it('should allow BUSINESS_OWNER to update without checking permissions', async () => {
      const ownerMember = {
        ...mockMember,
        role: Role.BUSINESS_OWNER,
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(ownerMember);

      const updatedTask = { ...mockTask, ...dto };
      mockTaskRepository.save.mockResolvedValue(updatedTask);

      const result = await service.updateTask(taskId, dto, 'user-123');

      expect(result).toEqual(updatedTask);
      expect(PermissionUtil.hasGranularPermission).not.toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    const taskId = 'task-123';

    const mockTask = {
      id: taskId,
      businessId: 'business-123',
      title: 'Task to delete',
      status: TaskStatus.TODO,
    };

    const mockMember = {
      user_id: 'user-123',
      business_id: 'business-123',
      role: Role.BUSINESS_ADMIN,
      is_active: true,
      collaboration_permissions: { delete_task: true },
      user: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
    };

    it('should delete a task successfully', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(true);

      mockTaskRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteTask(taskId, 'user-123');

      expect(result).toEqual({ message: 'Task deleted' });
      expect(taskRepo.delete).toHaveBeenCalledWith(taskId);
    });

    it('should throw NotFoundException if task does not exist', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteTask(taskId, 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks delete_task permission', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      (PermissionUtil.hasGranularPermission as jest.Mock).mockReturnValue(false);

      await expect(service.deleteTask(taskId, 'user-123')).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete tasks'),
      );
    });

    it('should allow BUSINESS_OWNER to delete without checking permissions', async () => {
      const ownerMember = {
        ...mockMember,
        role: Role.BUSINESS_OWNER,
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockMemberRepository.findOne.mockResolvedValue(ownerMember);
      mockTaskRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteTask(taskId, 'user-123');

      expect(result).toEqual({ message: 'Task deleted' });
      expect(PermissionUtil.hasGranularPermission).not.toHaveBeenCalled();
    });
  });
});
