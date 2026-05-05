import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationsService } from './invitations.service';
import { BusinessInvitation, InvitationStatus } from '../entities/business-invitation.entity';
import { Business } from '../entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { BusinessMembersService } from './business-members.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../users/enums/role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitationRepo: Repository<BusinessInvitation>;

  const mockInvitationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const mockBusinessRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBusinessMembersService = {
    hasAccess: jest.fn(),
    addMember: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(BusinessInvitation),
          useValue: mockInvitationRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
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
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    invitationRepo = module.get<Repository<BusinessInvitation>>(
      getRepositoryToken(BusinessInvitation),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendInvitation', () => {
    it('should send an invitation', async () => {
      const mockBusiness = {
        id: 'business-123',
        name: 'Test Business',
        tenant: { id: 'tenant-123' },
      };

      const mockInvitation = {
        id: 'invitation-123',
        business_id: 'business-123',
        email: 'newuser@example.com',
        role: Role.TEAM_MEMBER,
        token: 'token-123',
        status: InvitationStatus.PENDING,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(null);
      mockInvitationRepository.create.mockReturnValue(mockInvitation);
      mockInvitationRepository.save.mockResolvedValue(mockInvitation);

      const result = await service.sendInvitation(
        'business-123',
        'newuser@example.com',
        Role.TEAM_MEMBER,
        'user-123',
      );

      expect(invitationRepo.create).toHaveBeenCalled();
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockInvitation);
    });

    it('should throw BadRequestException if user is already a member', async () => {
      const mockBusiness = {
        id: 'business-123',
        name: 'Test Business',
        tenant: { id: 'tenant-123' },
      };

      const mockUser = {
        id: 'user-456',
        email: 'existing@example.com',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockBusinessMembersService.hasAccess.mockResolvedValue(true);

      await expect(
        service.sendInvitation('business-123', 'existing@example.com', Role.TEAM_MEMBER, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if pending invitation exists', async () => {
      const mockBusiness = {
        id: 'business-123',
        name: 'Test Business',
        tenant: { id: 'tenant-123' },
      };

      const existingInvitation = {
        id: 'invitation-123',
        status: InvitationStatus.PENDING,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(existingInvitation);

      await expect(
        service.sendInvitation('business-123', 'test@example.com', Role.TEAM_MEMBER, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInvitationByToken', () => {
    it('should return invitation by token', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        token: 'token-123',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000), // Tomorrow
        business: { id: 'business-123' },
        inviter: { id: 'user-123' },
      };

      mockInvitationRepository.findOne.mockResolvedValue(mockInvitation);

      const result = await service.getInvitationByToken('token-123');

      expect(result).toEqual(mockInvitation);
    });

    it('should throw NotFoundException if invitation not found', async () => {
      mockInvitationRepository.findOne.mockResolvedValue(null);

      await expect(service.getInvitationByToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if invitation expired', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        token: 'token-123',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() - 86400000), // Yesterday
      };

      mockInvitationRepository.findOne.mockResolvedValue(mockInvitation);
      mockInvitationRepository.save.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.EXPIRED,
      });

      await expect(service.getInvitationByToken('token-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        business_id: 'business-123',
        email: 'test@example.com',
        role: Role.TEAM_MEMBER,
        invited_by: 'user-123',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      };

      const mockUser = {
        id: 'user-456',
        email: 'test@example.com',
      };

      const acceptedInvitation = {
        ...mockInvitation,
        status: InvitationStatus.ACCEPTED,
        accepted_at: expect.any(Date),
      };

      mockInvitationRepository.findOne.mockResolvedValue(mockInvitation);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockBusinessMembersService.addMember.mockResolvedValue({});
      mockInvitationRepository.save.mockResolvedValue(acceptedInvitation);

      const result = await service.acceptInvitation('token-123', 'user-456');

      expect(mockBusinessMembersService.addMember).toHaveBeenCalledWith(
        'business-123',
        'user-456',
        Role.TEAM_MEMBER,
        'user-123',
      );
      expect(result.status).toBe(InvitationStatus.ACCEPTED);
    });
  });

  describe('getBusinessInvitations', () => {
    it('should return all invitations for a business', async () => {
      const mockInvitations = [
        {
          id: 'invitation-1',
          business_id: 'business-123',
          email: 'user1@example.com',
          status: InvitationStatus.PENDING,
        },
        {
          id: 'invitation-2',
          business_id: 'business-123',
          email: 'user2@example.com',
          status: InvitationStatus.ACCEPTED,
        },
      ];

      mockInvitationRepository.find.mockResolvedValue(mockInvitations);

      const result = await service.getBusinessInvitations('business-123');

      expect(invitationRepo.find).toHaveBeenCalledWith({
        where: { business_id: 'business-123' },
        relations: ['inviter'],
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual(mockInvitations);
    });
  });
});
