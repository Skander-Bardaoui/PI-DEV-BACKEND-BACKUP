import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from './activities.service';
import { Activity, ActivityType } from './entities/activity.entity';
import { BusinessMembersService } from '../businesses/services/business-members.service';
import { ForbiddenException } from '@nestjs/common';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let activityRepository: Repository<Activity>;
  let businessMembersService: BusinessMembersService;

  const mockActivityRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockBusinessMembersService = {
    hasAccess: jest.fn(),
    getUserRoleInBusiness: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: getRepositoryToken(Activity),
          useValue: mockActivityRepository,
        },
        {
          provide: BusinessMembersService,
          useValue: mockBusinessMembersService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    activityRepository = module.get<Repository<Activity>>(getRepositoryToken(Activity));
    businessMembersService = module.get<BusinessMembersService>(BusinessMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActivity', () => {
    it('should create a subtask completed activity', async () => {
      const data = {
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: 'business-123',
        userId: 'user-123',
        taskId: 'task-123',
        subtaskId: 'subtask-123',
        description: 'Completed subtask: Test subtask',
      };

      const mockActivity = {
        id: 'activity-123',
        ...data,
        createdAt: new Date(),
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.createActivity(data);

      expect(activityRepository.create).toHaveBeenCalledWith(data);
      expect(activityRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockActivity);
    });

    it('should create an overdue activity', async () => {
      const data = {
        type: ActivityType.SUBTASK_COMPLETED_OVERDUE,
        businessId: 'business-123',
        userId: 'user-123',
        taskId: 'task-123',
        subtaskId: 'subtask-123',
        description: 'Completed subtask OVERDUE',
        isOverdue: true,
      };

      const mockActivity = {
        id: 'activity-123',
        ...data,
        createdAt: new Date(),
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.createActivity(data);

      expect(result.isOverdue).toBe(true);
      expect(result.type).toBe(ActivityType.SUBTASK_COMPLETED_OVERDUE);
    });

    it('should create an on-time activity', async () => {
      const data = {
        type: ActivityType.SUBTASK_COMPLETED_ON_TIME,
        businessId: 'business-123',
        userId: 'user-123',
        taskId: 'task-123',
        subtaskId: 'subtask-123',
        description: 'Completed subtask ON TIME',
        isOnTime: true,
      };

      const mockActivity = {
        id: 'activity-123',
        ...data,
        createdAt: new Date(),
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.createActivity(data);

      expect(result.isOnTime).toBe(true);
      expect(result.type).toBe(ActivityType.SUBTASK_COMPLETED_ON_TIME);
    });

    it('should create a task blocked activity', async () => {
      const data = {
        type: ActivityType.TASK_BLOCKED,
        businessId: 'business-123',
        userId: 'user-123',
        taskId: 'task-123',
        description: 'Task moved to BLOCKED',
        isOverdue: true,
      };

      const mockActivity = {
        id: 'activity-123',
        ...data,
        createdAt: new Date(),
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.createActivity(data);

      expect(result.type).toBe(ActivityType.TASK_BLOCKED);
      expect(result.isOverdue).toBe(true);
    });

    it('should create activity without task or subtask', async () => {
      const data = {
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: 'business-123',
        userId: 'user-123',
        description: 'General activity',
      };

      const mockActivity = {
        id: 'activity-123',
        ...data,
        createdAt: new Date(),
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.createActivity(data);

      expect(result.taskId).toBeUndefined();
      expect(result.subtaskId).toBeUndefined();
    });
  });

  describe('findByBusiness', () => {
    it('should return activities for BUSINESS_OWNER', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      const mockActivities = [
        {
          id: 'activity-1',
          type: ActivityType.SUBTASK_COMPLETED,
          businessId,
          userId,
          description: 'Activity 1',
          createdAt: new Date(),
          user: { id: userId, email: 'user@example.com' },
          task: { id: 'task-1', title: 'Task 1' },
          subtask: { id: 'subtask-1', title: 'Subtask 1' },
        },
        {
          id: 'activity-2',
          type: ActivityType.TASK_BLOCKED,
          businessId,
          userId,
          description: 'Activity 2',
          createdAt: new Date(),
          user: { id: userId, email: 'user@example.com' },
          task: { id: 'task-2', title: 'Task 2' },
        },
      ];

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_OWNER');
      mockActivityRepository.find.mockResolvedValue(mockActivities);

      const result = await service.findByBusiness(businessId, userId);

      expect(businessMembersService.hasAccess).toHaveBeenCalledWith(userId, businessId);
      expect(businessMembersService.getUserRoleInBusiness).toHaveBeenCalledWith(
        userId,
        businessId,
      );
      expect(activityRepository.find).toHaveBeenCalledWith({
        where: { businessId },
        relations: ['user', 'task', 'subtask'],
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(mockActivities);
      expect(result).toHaveLength(2);
    });

    it('should return activities for BUSINESS_ADMIN', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      const mockActivities = [
        {
          id: 'activity-1',
          type: ActivityType.SUBTASK_COMPLETED_ON_TIME,
          businessId,
          userId,
          isOnTime: true,
        },
      ];

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_ADMIN');
      mockActivityRepository.find.mockResolvedValue(mockActivities);

      const result = await service.findByBusiness(businessId, userId);

      expect(result).toEqual(mockActivities);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(false);

      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        'You do not have access to this business',
      );
    });

    it('should throw ForbiddenException if user is TEAM_MEMBER', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('TEAM_MEMBER');

      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        'Only business owners and admins can view activities',
      );
    });

    it('should throw ForbiddenException if user is ACCOUNTANT', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('ACCOUNTANT');

      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user role is null', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue(null);

      await expect(service.findByBusiness(businessId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return empty array when no activities exist', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_OWNER');
      mockActivityRepository.find.mockResolvedValue([]);

      const result = await service.findByBusiness(businessId, userId);

      expect(result).toEqual([]);
    });

    it('should limit results to 50 activities', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_OWNER');
      mockActivityRepository.find.mockResolvedValue([]);

      await service.findByBusiness(businessId, userId);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should order activities by createdAt DESC', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_OWNER');
      mockActivityRepository.find.mockResolvedValue([]);

      await service.findByBusiness(businessId, userId);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('should include user, task, and subtask relations', async () => {
      const businessId = 'business-123';
      const userId = 'user-123';

      mockBusinessMembersService.hasAccess.mockResolvedValue(true);
      mockBusinessMembersService.getUserRoleInBusiness.mockResolvedValue('BUSINESS_OWNER');
      mockActivityRepository.find.mockResolvedValue([]);

      await service.findByBusiness(businessId, userId);

      expect(activityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'task', 'subtask'],
        }),
      );
    });
  });

  describe('Activity types', () => {
    it('should handle all activity types', async () => {
      const activityTypes = [
        ActivityType.SUBTASK_COMPLETED,
        ActivityType.SUBTASK_COMPLETED_OVERDUE,
        ActivityType.SUBTASK_COMPLETED_ON_TIME,
        ActivityType.TASK_BLOCKED,
      ];

      for (const type of activityTypes) {
        const data = {
          type,
          businessId: 'business-123',
          userId: 'user-123',
          description: `Activity of type ${type}`,
        };

        const mockActivity = {
          id: `activity-${type}`,
          ...data,
          createdAt: new Date(),
        };

        mockActivityRepository.create.mockReturnValue(mockActivity);
        mockActivityRepository.save.mockResolvedValue(mockActivity);

        const result = await service.createActivity(data);

        expect(result.type).toBe(type);
      }
    });
  });
});
