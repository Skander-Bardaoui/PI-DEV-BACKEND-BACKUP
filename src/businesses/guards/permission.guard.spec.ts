// src/businesses/guards/permission.guard.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionGuard } from './permission.guard';
import { BusinessMember } from '../entities/business-member.entity';
import { Role } from '../../users/enums/role.enum';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let businessMemberRepository: Repository<BusinessMember>;

  const mockBusinessMemberRepository = {
    findOne: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockBusinessMemberRepository,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    businessMemberRepository = module.get<Repository<BusinessMember>>(
      getRepositoryToken(BusinessMember),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: any,
    params: any = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
        }),
      }),
      getHandler: () => ({}),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when no permission requirement is set', async () => {
      mockReflector.get.mockReturnValue(undefined);

      const context = createMockExecutionContext({ id: 'user1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for platform admin', async () => {
      mockReflector.get.mockReturnValue('create_task');

      const user = { id: 'user1', role: Role.PLATFORM_ADMIN };
      const context = createMockExecutionContext(user, { id: 'business1' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', async () => {
      mockReflector.get.mockReturnValue('create_task');

      const context = createMockExecutionContext(null, { id: 'business1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when business ID is missing', async () => {
      mockReflector.get.mockReturnValue('create_task');

      const user = { id: 'user1', role: Role.TEAM_MEMBER };
      const context = createMockExecutionContext(user, {});

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when user is not a business member', async () => {
      mockReflector.get.mockReturnValue('create_task');
      mockBusinessMemberRepository.findOne.mockResolvedValue(null);

      const user = { id: 'user1', role: Role.TEAM_MEMBER };
      const context = createMockExecutionContext(user, { id: 'business1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockBusinessMemberRepository.findOne).toHaveBeenCalledWith({
        where: {
          business_id: 'business1',
          user_id: 'user1',
          is_active: true,
        },
      });
    });

    it('should allow access when user has required permission', async () => {
      mockReflector.get.mockReturnValue('create_task');
      
      const membership = {
        id: 'member1',
        business_id: 'business1',
        user_id: 'user1',
        collaboration_permissions: { create_task: true }, // Has CREATE permission
        is_active: true,
        role: Role.TEAM_MEMBER,
      };
      mockBusinessMemberRepository.findOne.mockResolvedValue(membership);

      const user = { id: 'user1', role: Role.TEAM_MEMBER };
      const context = createMockExecutionContext(user, { id: 'business1' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required permission', async () => {
      mockReflector.get.mockReturnValue('create_task');
      
      const membership = {
        id: 'member1',
        business_id: 'business1',
        user_id: 'user1',
        collaboration_permissions: { create_task: false }, // No permission
        is_active: true,
        role: Role.TEAM_MEMBER,
      };
      mockBusinessMemberRepository.findOne.mockResolvedValue(membership);

      const user = { id: 'user1', role: Role.TEAM_MEMBER };
      const context = createMockExecutionContext(user, { id: 'business1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should work with businessId parameter', async () => {
      mockReflector.get.mockReturnValue('update_task');
      
      const membership = {
        id: 'member1',
        business_id: 'business1',
        user_id: 'user1',
        collaboration_permissions: { update_task: true }, // Has UPDATE permission
        is_active: true,
        role: Role.TEAM_MEMBER,
      };
      mockBusinessMemberRepository.findOne.mockResolvedValue(membership);

      const user = { id: 'user1', role: Role.TEAM_MEMBER };
      const context = createMockExecutionContext(user, { businessId: 'business1' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockBusinessMemberRepository.findOne).toHaveBeenCalledWith({
        where: {
          business_id: 'business1',
          user_id: 'user1',
          is_active: true,
        },
      });
    });
  });
});