import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityType } from './entities/activity.entity';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;
  let service: ActivitiesService;

  const mockActivitiesService = {
    findByBusiness: jest.fn(),
    createActivity: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    }).compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
    service = module.get<ActivitiesService>(ActivitiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByBusiness', () => {
    it('should return activities for a business', async () => {
      const businessId = 'business-123';
      const mockActivities = [
        {
          id: 'activity-1',
          type: ActivityType.SUBTASK_COMPLETED,
          businessId,
          userId: 'user-123',
          description: 'Completed subtask',
          createdAt: new Date(),
        },
        {
          id: 'activity-2',
          type: ActivityType.TASK_BLOCKED,
          businessId,
          userId: 'user-456',
          description: 'Task blocked',
          createdAt: new Date(),
        },
      ];

      mockActivitiesService.findByBusiness.mockResolvedValue(mockActivities);

      const result = await controller.findByBusiness(businessId, mockRequest);

      expect(service.findByBusiness).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual(mockActivities);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no activities exist', async () => {
      const businessId = 'business-123';

      mockActivitiesService.findByBusiness.mockResolvedValue([]);

      const result = await controller.findByBusiness(businessId, mockRequest);

      expect(service.findByBusiness).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual([]);
    });

    it('should pass correct user id from request', async () => {
      const businessId = 'business-456';
      const customRequest = {
        user: {
          id: 'user-789',
          email: 'custom@example.com',
        },
      };

      mockActivitiesService.findByBusiness.mockResolvedValue([]);

      await controller.findByBusiness(businessId, customRequest);

      expect(service.findByBusiness).toHaveBeenCalledWith(businessId, 'user-789');
    });
  });

  describe('testCreate', () => {
    it('should create a test activity with task', async () => {
      const body = {
        businessId: 'business-123',
        taskId: 'task-123',
      };

      const mockActivity = {
        id: 'activity-123',
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        taskId: body.taskId,
        description: 'Test activity',
        createdAt: new Date(),
      };

      mockActivitiesService.createActivity.mockResolvedValue(mockActivity);

      const result = await controller.testCreate(body, mockRequest);

      expect(service.createActivity).toHaveBeenCalledWith({
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        taskId: body.taskId,
        subtaskId: undefined,
        description: 'Test activity',
      });
      expect(result).toEqual(mockActivity);
    });

    it('should create a test activity with subtask', async () => {
      const body = {
        businessId: 'business-123',
        taskId: 'task-123',
        subtaskId: 'subtask-123',
      };

      const mockActivity = {
        id: 'activity-123',
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        taskId: body.taskId,
        subtaskId: body.subtaskId,
        description: 'Test activity',
        createdAt: new Date(),
      };

      mockActivitiesService.createActivity.mockResolvedValue(mockActivity);

      const result = await controller.testCreate(body, mockRequest);

      expect(service.createActivity).toHaveBeenCalledWith({
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        taskId: body.taskId,
        subtaskId: body.subtaskId,
        description: 'Test activity',
      });
      expect(result.subtaskId).toBe('subtask-123');
    });

    it('should create a test activity without task or subtask', async () => {
      const body = {
        businessId: 'business-123',
      };

      const mockActivity = {
        id: 'activity-123',
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        description: 'Test activity',
        createdAt: new Date(),
      };

      mockActivitiesService.createActivity.mockResolvedValue(mockActivity);

      const result = await controller.testCreate(body, mockRequest);

      expect(service.createActivity).toHaveBeenCalledWith({
        type: ActivityType.SUBTASK_COMPLETED,
        businessId: body.businessId,
        userId: 'user-123',
        taskId: undefined,
        subtaskId: undefined,
        description: 'Test activity',
      });
      expect(result).toEqual(mockActivity);
    });
  });

  describe('authentication', () => {
    it('should use authenticated user id for all operations', async () => {
      const businessId = 'business-123';
      const body = { businessId };

      mockActivitiesService.findByBusiness.mockResolvedValue([]);
      mockActivitiesService.createActivity.mockResolvedValue({} as any);

      await controller.findByBusiness(businessId, mockRequest);
      await controller.testCreate(body, mockRequest);

      expect(service.findByBusiness).toHaveBeenCalledWith(businessId, 'user-123');
      expect(service.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
      );
    });
  });
});
