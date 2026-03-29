// src/businesses/services/business-members.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BusinessMember } from '../entities/business-member.entity';
import { Business } from '../entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/enums/role.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Injectable()
export class BusinessMembersService {
  constructor(
    @InjectRepository(BusinessMember)
    private businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Get all businesses accessible by a user
   */
  async getUserBusinesses(userId: string): Promise<Business[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // PLATFORM_ADMIN can see all businesses
    if (user.role === Role.PLATFORM_ADMIN) {
      return this.businessRepository.find({
        order: { created_at: 'DESC' },
      });
    }

    // BUSINESS_OWNER can see all businesses in their tenant
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepository.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        return this.businessRepository.find({
          where: { tenant_id: tenant.id },
          order: { created_at: 'DESC' },
        });
      }
    }

    // Other roles: get businesses they're members of
    const memberships = await this.businessMemberRepository.find({
      where: { user_id: userId, is_active: true },
      relations: ['business'],
    });

    return memberships.map((m) => m.business);
  }

  /**
   * Get all members of a business
   */
  async getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
    return this.businessMemberRepository.find({
      where: { business_id: businessId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Add a member to a business
   */
  async addMember(
    businessId: string,
    userId: string,
    role: Role,
    invitedBy: string,
  ): Promise<BusinessMember> {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existing = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this business');
    }

    // Create membership
    const member = this.businessMemberRepository.create({
      business_id: businessId,
      user_id: userId,
      role,
      invited_by: invitedBy,
      invited_at: new Date(),
      joined_at: new Date(),
      is_active: true,
    });

    return this.businessMemberRepository.save(member);
  }

  /**
   * Remove a member from a business
   */
  async removeMember(businessId: string, userId: string): Promise<void> {
    const result = await this.businessMemberRepository.delete({
      business_id: businessId,
      user_id: userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Member not found');
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    businessId: string,
    userId: string,
    newRole: Role,
  ): Promise<BusinessMember> {
    console.log('BusinessMembersService.updateMemberRole called:', { businessId, userId, newRole });
    
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
      relations: ['user'],
    });

    if (!member) {
      console.log('Member not found:', { businessId, userId });
      throw new NotFoundException('Member not found');
    }

    console.log('Found member:', { id: member.id, currentRole: member.role, newRole });
    
    // Update role in business_members table
    member.role = newRole;
    const saved = await this.businessMemberRepository.save(member);
    
    // Also update role in users table
    await this.userRepository.update(userId, { role: newRole });
    
    console.log('Member role updated in both tables:', { id: saved.id, role: saved.role });
    
    return saved;
  }

  /**
   * Check if user has access to a business
   */
  async hasAccess(userId: string, businessId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // PLATFORM_ADMIN has access to everything
    if (user.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    // Check if BUSINESS_OWNER owns the tenant
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepository.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        const business = await this.businessRepository.findOne({
          where: { id: businessId },
        });

        return business?.tenant_id === tenant.id;
      }
    }

    // Check membership
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    return !!member;
  }

  /**
   * Get user's role in a specific business
   */
  async getUserRoleInBusiness(
    userId: string,
    businessId: string,
  ): Promise<Role | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    // PLATFORM_ADMIN
    if (user.role === Role.PLATFORM_ADMIN) {
      return Role.PLATFORM_ADMIN;
    }

    // BUSINESS_OWNER
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepository.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        const business = await this.businessRepository.findOne({
          where: { id: businessId },
        });

        if (business?.tenant_id === tenant.id) {
          return Role.BUSINESS_OWNER;
        }
      }
    }

    // Check membership
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    return member?.role || null;
  }
}
