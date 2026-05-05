import { Test, TestingModule } from '@nestjs/testing';
import { DailyCheckinsController } from './daily-checkins.controller';
import { DailyCheckinsService } from './daily-checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

describe('DailyCheckinsController', () => {
  let controller: DailyCheckinsController;
  let service: DailyCheckinsService;

  const mockDailyCheckinsService = {
    createCheckin: jest.fn(),
    hasCheckedInToday: jest.fn(),
    getBusinessCheckinsToday: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyCheckinsController],
      providers: [
        {
          provide: DailyCheckinsService,
          useValue: mockDailyCheckinsService,
        },
      ],
    }).compile();

    controller = module.get<DailyCheckinsController>(DailyCheckinsController);
    service = module.get<DailyCheckinsService>(DailyCheckinsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a check-in', async () => {
      const dto: CreateCheckinDto = {
        businessId: 'business-123',
        taskIds: ['task-1', 'task-2'],
        note: 'Test note',
        skipped: false,
      };

      const expectedResult = {
        id: 'checkin-123',
        userId: 'user-123',
        businessId: 'business-123',
        taskIds: ['task-1', 'task-2'],
        note: 'Test note',
        skipped: false,
        checkinDate: new Date(),
      };

      mockDailyCheckinsService.createCheckin.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, mockRequest);

      expect(service.createCheckin).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should create a skipped check-in', async () => {
      const dto: CreateCheckinDto = {
        businessId: 'business-123',
        taskIds: [],
        note: 'Skipped today',
        skipped: true,
      };

      const expectedResult = {
        id: 'checkin-124',
        userId: 'user-123',
        businessId: 'business-123',
        taskIds: [],
        note: 'Skipped today',
        skipped: true,
        checkinDate: new Date(),
      };

      mockDailyCheckinsService.createCheckin.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, mockRequest);

      expect(service.createCheckin).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('hasCheckedInToday', () => {
    it('should return true if user has checked in today', async () => {
      const expectedResult = { hasCheckedIn: true };

      mockDailyCheckinsService.hasCheckedInToday.mockResolvedValue(expectedResult);

      const result = await controller.hasCheckedInToday(mockRequest);

      expect(service.hasCheckedInToday).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should return false if user has not checked in today', async () => {
      const expectedResult = { hasCheckedIn: false };

      mockDailyCheckinsService.hasCheckedInToday.mockResolvedValue(expectedResult);

      const result = await controller.hasCheckedInToday(mockRequest);

      expect(service.hasCheckedInToday).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getBusinessCheckinsToday', () => {
    it('should return business check-ins for today', async () => {
      const businessId = 'business-123';
      const expectedResult = {
        members: [
          {
            userId: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            avatarUrl: null,
            status: 'checked_in',
            tasks: [{ id: 'task-1', title: 'Task 1' }],
            note: 'Completed tasks',
          },
          {
            userId: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            avatarUrl: null,
            status: 'pending',
            tasks: [],
            note: null,
          },
        ],
        summary: {
          checkedIn: 1,
          skipped: 0,
          pending: 1,
        },
      };

      mockDailyCheckinsService.getBusinessCheckinsToday.mockResolvedValue(expectedResult);

      const result = await controller.getBusinessCheckinsToday(businessId, mockRequest);

      expect(service.getBusinessCheckinsToday).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual(expectedResult);
    });

    it('should return empty members list if no team members exist', async () => {
      const businessId = 'business-456';
      const expectedResult = {
        members: [],
        summary: {
          checkedIn: 0,
          skipped: 0,
          pending: 0,
        },
      };

      mockDailyCheckinsService.getBusinessCheckinsToday.mockResolvedValue(expectedResult);

      const result = await controller.getBusinessCheckinsToday(businessId, mockRequest);

      expect(service.getBusinessCheckinsToday).toHaveBeenCalledWith(businessId, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });
});
