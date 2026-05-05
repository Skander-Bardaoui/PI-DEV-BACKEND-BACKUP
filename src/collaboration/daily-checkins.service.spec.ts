import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyCheckinsService } from './daily-checkins.service';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Business } from '../businesses/entities/business.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Task } from './entities/task.entity';
import { Role } from '../users/enums/role.enum';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('DailyCheckinsService', () => {
  let service: DailyCheckinsService;
  let checkinRepo: Repository<DailyCheckin>;
  let memberRepo: Repository<BusinessMember>;
  let taskRepo: Repository<Task>;
  let businessRepo: Repository<Business>;
  let tenantRepo: Repository<Tenant>;

  const mockCheckinRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockMemberRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockTaskRepository = {
    find: jest.fn(),
  };

  const mockBusinessRepository = {};
  const mockTenantRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyCheckinsService,
        {
          provide: getRepositoryToken(DailyCheckin),
          useValue: mockCheckinRepository,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<DailyCheckinsService>(DailyCheckinsService);
    checkinRepo = module.get<Repository<DailyCheckin>>(getRepositoryToken(DailyCheckin));
    memberRepo = module.get<Repository<BusinessMember>>(getRepositoryToken(BusinessMember));
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    businessRepo = module.get<Repository<Business>>(getRepositoryToken(Business));
    tenantRepo = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
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

  describe('createCheckin', () => {
    const dto: CreateCheckinDto = {
      businessId: 'business-123',
      taskIds: ['task-1', 'task-2'],
      note: 'Test note',
      skipped: false,
    };

    const mockMember = {
      user_id: 'user-123',
      business_id: 'business-123',
      role: Role.TEAM_MEMBER,
      is_active: true,
      user: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
    };

    it('should create a check-in successfully', async () => {
      mockMemberRepository.findOne
        .mockResolvedValueOnce(mockMember) // hasAccess call
        .mockResolvedValueOnce(mockMember); // role verification call

      mockCheckinRepository.findOne.mockResolvedValue(null); // No existing check-in

      const mockCheckin = {
        id: 'checkin-123',
        userId: 'user-123',
        businessId: 'business-123',
        taskIds: ['task-1', 'task-2'],
        note: 'Test note',
        skipped: false,
        checkinDate: expect.any(Date),
      };

      mockCheckinRepository.create.mockReturnValue(mockCheckin);
      mockCheckinRepository.save.mockResolvedValue(mockCheckin);

      const result = await service.createCheckin(dto, 'user-123');

      expect(result).toEqual(mockCheckin);
      expect(checkinRepo.create).toHaveBeenCalled();
      expect(checkinRepo.save).toHaveBeenCalledWith(mockCheckin);
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.createCheckin(dto, 'user-123')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user role is not TEAM_MEMBER or ACCOUNTANT', async () => {
      const businessOwnerMember = {
        ...mockMember,
        role: Role.BUSINESS_OWNER,
      };

      mockMemberRepository.findOne
        .mockResolvedValueOnce(businessOwnerMember)
        .mockResolvedValueOnce(businessOwnerMember);

      await expect(service.createCheckin(dto, 'user-123')).rejects.toThrow(
        new ForbiddenException('Only TEAM_MEMBER and ACCOUNTANT can submit check-ins'),
      );
    });

    it('should throw ConflictException if already checked in today', async () => {
      mockMemberRepository.findOne
        .mockResolvedValueOnce(mockMember)
        .mockResolvedValueOnce(mockMember);

      const existingCheckin = {
        id: 'checkin-existing',
        userId: 'user-123',
        checkinDate: new Date(),
      };

      mockCheckinRepository.findOne.mockResolvedValue(existingCheckin);

      await expect(service.createCheckin(dto, 'user-123')).rejects.toThrow(ConflictException);
    });

    it('should allow ACCOUNTANT to create check-in', async () => {
      const accountantMember = {
        ...mockMember,
        role: Role.ACCOUNTANT,
      };

      mockMemberRepository.findOne
        .mockResolvedValueOnce(accountantMember)
        .mockResolvedValueOnce(accountantMember);

      mockCheckinRepository.findOne.mockResolvedValue(null);

      const mockCheckin = {
        id: 'checkin-123',
        userId: 'user-123',
        businessId: 'business-123',
        taskIds: ['task-1', 'task-2'],
        note: 'Test note',
        skipped: false,
        checkinDate: expect.any(Date),
      };

      mockCheckinRepository.create.mockReturnValue(mockCheckin);
      mockCheckinRepository.save.mockResolvedValue(mockCheckin);

      const result = await service.createCheckin(dto, 'user-123');

      expect(result).toEqual(mockCheckin);
    });
  });

  describe('hasCheckedInToday', () => {
    it('should return true if user has checked in today', async () => {
      const mockCheckin = {
        id: 'checkin-123',
        userId: 'user-123',
        checkinDate: new Date(),
      };

      mockCheckinRepository.findOne.mockResolvedValue(mockCheckin);

      const result = await service.hasCheckedInToday('user-123');

      expect(result).toEqual({ hasCheckedIn: true });
    });

    it('should return false if user has not checked in today', async () => {
      mockCheckinRepository.findOne.mockResolvedValue(null);

      const result = await service.hasCheckedInToday('user-123');

      expect(result).toEqual({ hasCheckedIn: false });
    });
  });

  describe('getBusinessCheckinsToday', () => {
    const businessId = 'business-123';
    const userId = 'user-123';

    const mockMembers = [
      {
        user_id: 'user-1',
        business_id: businessId,
        role: Role.TEAM_MEMBER,
        is_active: true,
        user: { id: 'user-1', firstName: 'John', lastName: 'Doe', avatarUrl: null },
      },
      {
        user_id: 'user-2',
        business_id: businessId,
        role: Role.ACCOUNTANT,
        is_active: true,
        user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', avatarUrl: null },
      },
      {
        user_id: 'user-3',
        business_id: businessId,
        role: Role.BUSINESS_ADMIN,
        is_active: true,
        user: { id: 'user-3', firstName: 'Admin', lastName: 'User', avatarUrl: null },
      },
    ];

    it('should return business check-ins for today', async () => {
      mockMemberRepository.findOne.mockResolvedValue({ user_id: userId, business_id: businessId, is_active: true });
      mockMemberRepository.find.mockResolvedValue(mockMembers);

      const mockCheckins = [
        {
          userId: 'user-1',
          businessId,
          taskIds: ['task-1'],
          note: 'Completed',
          skipped: false,
          checkinDate: new Date(),
          user: mockMembers[0].user,
        },
      ];

      mockCheckinRepository.find.mockResolvedValue(mockCheckins);
      mockTaskRepository.find.mockResolvedValue([{ id: 'task-1', title: 'Task 1' }]);

      const result = await service.getBusinessCheckinsToday(businessId, userId);

      expect(result.members).toHaveLength(2); // Only TEAM_MEMBER and ACCOUNTANT
      expect(result.summary.checkedIn).toBe(1);
      expect(result.summary.pending).toBe(1);
      expect(result.summary.skipped).toBe(0);
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      mockMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.getBusinessCheckinsToday(businessId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should handle skipped check-ins', async () => {
      mockMemberRepository.findOne.mockResolvedValue({ user_id: userId, business_id: businessId, is_active: true });
      mockMemberRepository.find.mockResolvedValue([mockMembers[0]]);

      const mockCheckins = [
        {
          userId: 'user-1',
          businessId,
          taskIds: [],
          note: 'Skipped today',
          skipped: true,
          checkinDate: new Date(),
          user: mockMembers[0].user,
        },
      ];

      mockCheckinRepository.find.mockResolvedValue(mockCheckins);

      const result = await service.getBusinessCheckinsToday(businessId, userId);

      expect(result.members[0].status).toBe('skipped');
      expect(result.summary.skipped).toBe(1);
    });
  });
});
