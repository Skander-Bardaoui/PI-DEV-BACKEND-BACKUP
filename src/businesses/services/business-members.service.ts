// src/businesses/services/business-members.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BusinessMember } from '../entities/business-member.entity';
import { Business } from '../entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/enums/role.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PermissionUtil } from '../utils/permission.util';

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
   * Get default salary permissions based on role
   */
  private getRoleDefaultSalaryPermissions(role: Role): Record<string, boolean> {
    if (role === Role.BUSINESS_OWNER || role === Role.PLATFORM_ADMIN) {
      return {
        create_salary: true,
        update_salary: true,
        delete_salary: true,
        send_proposal: true,
        pay_salary: true,
      };
    }
    
    // All other roles have no salary permissions by default
    return {
      create_salary: false,
      update_salary: false,
      delete_salary: false,
      send_proposal: false,
      pay_salary: false,
    };
  }

  /**
   * Get default sales permissions based on role
   */
  private getRoleDefaultSalesPermissions(role: Role): Record<string, boolean> {
    if (role === Role.BUSINESS_OWNER || role === Role.PLATFORM_ADMIN) {
      return {
        create_client: true,
        update_client: true,
        delete_client: true,
        invite_client: true,
        create_quote: true,
        update_quote: true,
        delete_quote: true,
        send_quote: true,
        convert_quote: true,
        create_order: true,
        update_order: true,
        cancel_order: true,
        create_delivery: true,
        update_delivery: true,
        cancel_delivery: true,
        create_invoice: true,
        update_invoice: true,
        delete_invoice: true,
        send_invoice: true,
        create_recurring: true,
        update_recurring: true,
        delete_recurring: true,
      };
    }
    
    if (role === Role.BUSINESS_ADMIN) {
      return {
        create_client: true,
        update_client: true,
        delete_client: false,
        invite_client: true,
        create_quote: true,
        update_quote: true,
        delete_quote: false,
        send_quote: true,
        convert_quote: true,
        create_order: true,
        update_order: true,
        cancel_order: false,
        create_delivery: true,
        update_delivery: true,
        cancel_delivery: false,
        create_invoice: true,
        update_invoice: true,
        delete_invoice: false,
        send_invoice: true,
        create_recurring: true,
        update_recurring: true,
        delete_recurring: false,
      };
    }
    
    if (role === Role.ACCOUNTANT) {
      return {
        create_client: true,
        update_client: true,
        delete_client: false,
        invite_client: false,
        create_quote: true,
        update_quote: true,
        delete_quote: false,
        send_quote: true,
        convert_quote: false,
        create_order: false,
        update_order: false,
        cancel_order: false,
        create_delivery: false,
        update_delivery: false,
        cancel_delivery: false,
        create_invoice: true,
        update_invoice: false,
        delete_invoice: false,
        send_invoice: true,
        create_recurring: false,
        update_recurring: false,
        delete_recurring: false,
      };
    }
    
    // TEAM_MEMBER and others have minimal permissions
    return {
      create_client: false,
      update_client: false,
      delete_client: false,
      invite_client: false,
      create_quote: true,
      update_quote: false,
      delete_quote: false,
      send_quote: false,
      convert_quote: false,
      create_order: false,
      update_order: false,
      cancel_order: false,
      create_delivery: false,
      update_delivery: false,
      cancel_delivery: false,
      create_invoice: false,
      update_invoice: false,
      delete_invoice: false,
      send_invoice: false,
      create_recurring: false,
      update_recurring: false,
      delete_recurring: false,
    };
  }

  /**
   * Get default purchase permissions based on role
   */
  private getRoleDefaultPurchasePermissions(role: Role): Record<string, boolean> {
    if (role === Role.BUSINESS_OWNER || role === Role.PLATFORM_ADMIN) {
      return {
        create_supplier: true,
        update_supplier: true,
        delete_supplier: true,
        invite_supplier: true,
        create_purchase_order: true,
        update_purchase_order: true,
        delete_purchase_order: true,
        send_purchase_order: true,
        confirm_purchase_order: true,
        create_goods_receipt: true,
        update_goods_receipt: true,
        delete_goods_receipt: true,
        validate_goods_receipt: true,
        create_purchase_invoice: true,
        update_purchase_invoice: true,
        delete_purchase_invoice: true,
        pay_purchase_invoice: true,
        create_purchase_return: true,
        update_purchase_return: true,
        delete_purchase_return: true,
        approve_purchase_return: true,
      };
    }
    
    if (role === Role.BUSINESS_ADMIN) {
      return {
        create_supplier: true,
        update_supplier: true,
        delete_supplier: false,
        invite_supplier: true,
        create_purchase_order: true,
        update_purchase_order: true,
        delete_purchase_order: false,
        send_purchase_order: true,
        confirm_purchase_order: true,
        create_goods_receipt: true,
        update_goods_receipt: true,
        delete_goods_receipt: false,
        validate_goods_receipt: true,
        create_purchase_invoice: true,
        update_purchase_invoice: true,
        delete_purchase_invoice: false,
        pay_purchase_invoice: true,
        create_purchase_return: true,
        update_purchase_return: true,
        delete_purchase_return: false,
        approve_purchase_return: true,
      };
    }
    
    if (role === Role.ACCOUNTANT) {
      return {
        create_supplier: true,
        update_supplier: true,
        delete_supplier: false,
        invite_supplier: false,
        create_purchase_order: false,
        update_purchase_order: false,
        delete_purchase_order: false,
        send_purchase_order: false,
        confirm_purchase_order: false,
        create_goods_receipt: false,
        update_goods_receipt: false,
        delete_goods_receipt: false,
        validate_goods_receipt: false,
        create_purchase_invoice: true,
        update_purchase_invoice: true,
        delete_purchase_invoice: false,
        pay_purchase_invoice: true,
        create_purchase_return: false,
        update_purchase_return: false,
        delete_purchase_return: false,
        approve_purchase_return: false,
      };
    }
    
    // TEAM_MEMBER and others have minimal permissions
    return {
      create_supplier: false,
      update_supplier: false,
      delete_supplier: false,
      invite_supplier: false,
      create_purchase_order: false,
      update_purchase_order: false,
      delete_purchase_order: false,
      send_purchase_order: false,
      confirm_purchase_order: false,
      create_goods_receipt: true,
      update_goods_receipt: false,
      delete_goods_receipt: false,
      validate_goods_receipt: false,
      create_purchase_invoice: false,
      update_purchase_invoice: false,
      delete_purchase_invoice: false,
      pay_purchase_invoice: false,
      create_purchase_return: false,
      update_purchase_return: false,
      delete_purchase_return: false,
      approve_purchase_return: false,
    };
  }

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
   * Add a member to a business with enhanced validation and error handling
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
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify inviter exists
    const inviter = await this.userRepository.findOne({
      where: { id: invitedBy },
    });

    if (!inviter) {
      throw new NotFoundException(`Inviter with ID ${invitedBy} not found`);
    }

    // Check if already a member
    const existing = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
    });

    if (existing) {
      throw new BadRequestException(
        `User ${userId} is already a member of business ${businessId}`
      );
    }

    // Validate role
    const validRoles = [Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.TEAM_MEMBER, Role.ACCOUNTANT];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    // Get role-based default permissions
    const defaultCollaborationPermissions = PermissionUtil.getRoleDefaultCollaborationPermissions(role);
    const defaultStockPermissions = PermissionUtil.getRoleDefaultStockPermissions(role);
    const defaultPaymentPermissions = PermissionUtil.getRoleDefaultPaymentPermissions(role);
    const defaultSalaryPermissions = this.getRoleDefaultSalaryPermissions(role);
    const defaultSalesPermissions = this.getRoleDefaultSalesPermissions(role);
    const defaultPurchasePermissions = this.getRoleDefaultPurchasePermissions(role);

    // Create membership with role-based default permissions
    const member = this.businessMemberRepository.create({
      business_id: businessId,
      user_id: userId,
      role,
      collaboration_permissions: defaultCollaborationPermissions,
      stock_permissions: defaultStockPermissions,
      payment_permissions: defaultPaymentPermissions,
      salary_permissions: defaultSalaryPermissions,
      sales_permissions: defaultSalesPermissions,
      purchase_permissions: defaultPurchasePermissions,
      invited_by: invitedBy,
      invited_at: new Date(),
      joined_at: new Date(),
      is_active: true,
    });

    try {
      const savedMember = await this.businessMemberRepository.save(member);
      
      console.log(`Member added successfully:`, {
        businessId,
        userId,
        role,
        collaboration_permissions: defaultCollaborationPermissions,
        stock_permissions: defaultStockPermissions,
        payment_permissions: defaultPaymentPermissions,
        invitedBy,
        createdAt: new Date().toISOString()
      });

      return savedMember;
    } catch (error) {
      console.error('Error adding member to business:', error);
      throw new BadRequestException('Failed to add member to business');
    }
  }

  /**
   * Create a new business member with default permissions based on role
   * This is an alias for addMember to match the task requirements
   */
  async createMember(
    businessId: string,
    userId: string,
    role: Role,
    invitedBy: string,
  ): Promise<BusinessMember> {
    return this.addMember(businessId, userId, role, invitedBy);
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
   * Update member role with enhanced validation and permission consistency
   */
  async updateMemberRole(
    businessId: string,
    userId: string,
    newRole: Role,
  ): Promise<BusinessMember> {
    console.log('BusinessMembersService.updateMemberRole called:', { businessId, userId, newRole });
    
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Find the member
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
      relations: ['user'],
    });

    if (!member) {
      console.log('Member not found:', { businessId, userId });
      throw new NotFoundException(`Member not found for user ${userId} in business ${businessId}`);
    }

    // Validate that the member is active
    if (!member.is_active) {
      throw new BadRequestException('Cannot update role for inactive member');
    }

    // Validate new role
    const validRoles = [Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.TEAM_MEMBER, Role.ACCOUNTANT];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
    }

    console.log('Found member:', { id: member.id, currentRole: member.role, newRole });
    
    const previousRole = member.role;
    const previousCollaborationPermissions = member.collaboration_permissions;
    const previousStockPermissions = member.stock_permissions;
    const previousPaymentPermissions = member.payment_permissions;
    
    // Update role in business_members table
    member.role = newRole;
    
    // If promoting to BUSINESS_OWNER, set full permissions (requirement 7.5)
    if (newRole === Role.BUSINESS_OWNER) {
      member.collaboration_permissions = PermissionUtil.getRoleDefaultCollaborationPermissions(newRole);
      member.stock_permissions = PermissionUtil.getRoleDefaultStockPermissions(newRole);
      member.payment_permissions = PermissionUtil.getRoleDefaultPaymentPermissions(newRole);
      member.salary_permissions = this.getRoleDefaultSalaryPermissions(newRole);
      member.sales_permissions = this.getRoleDefaultSalesPermissions(newRole);
      member.purchase_permissions = this.getRoleDefaultPurchasePermissions(newRole);
      console.log('Promoting to BUSINESS_OWNER, setting full permissions');
    }
    // Note: When demoting from BUSINESS_OWNER, permissions are preserved (requirement 7.6)
    // This is a security consideration - permissions must be manually adjusted if needed
    
    try {
      const saved = await this.businessMemberRepository.save(member);
      
      // Also update role in users table
      await this.userRepository.update(userId, { role: newRole });
      
      console.log('Member role updated successfully:', {
        businessId,
        userId,
        previousRole,
        newRole,
        previousCollaborationPermissions,
        newCollaborationPermissions: saved.collaboration_permissions,
        previousStockPermissions,
        newStockPermissions: saved.stock_permissions,
        previousPaymentPermissions,
        newPaymentPermissions: saved.payment_permissions,
        updatedAt: new Date().toISOString()
      });
      
      return saved;
    } catch (error) {
      console.error('Error updating member role:', error);
      throw new BadRequestException('Failed to update member role');
    }
  }

  /**
   * Seed existing business members with role-based default permissions
   * This method updates all business members that have null or empty permissions
   * with appropriate permissions based on their role
   */
  async seedExistingMembersWithDefaultPermissions(): Promise<{ updated: number; skipped: number }> {
    console.log('Starting to seed existing business members with default permissions...');
    
    // Find all business members with null or empty permissions
    const membersWithoutPermissions = await this.businessMemberRepository.find({
      where: [
        { collaboration_permissions: null as any },
        { stock_permissions: null as any },
      ],
      relations: ['user'],
    });

    console.log(`Found ${membersWithoutPermissions.length} members without permissions`);

    let updated = 0;
    let skipped = 0;

    for (const member of membersWithoutPermissions) {
      try {
        const defaultCollaborationPermissions = PermissionUtil.getRoleDefaultCollaborationPermissions(member.role);
        const defaultStockPermissions = PermissionUtil.getRoleDefaultStockPermissions(member.role);
        const defaultPaymentPermissions = PermissionUtil.getRoleDefaultPaymentPermissions(member.role);
        
        // Update permissions if they are null
        if (!member.collaboration_permissions) {
          member.collaboration_permissions = defaultCollaborationPermissions;
        }
        if (!member.stock_permissions) {
          member.stock_permissions = defaultStockPermissions;
        }
        if (!member.payment_permissions) {
          member.payment_permissions = defaultPaymentPermissions;
        }
        
        await this.businessMemberRepository.save(member);
        updated++;
        
        console.log(`Updated member ${member.user_id} (${member.role}) with default permissions`);
      } catch (error) {
        console.error(`Error updating member ${member.id}:`, error);
        skipped++;
      }
    }

    console.log(`Permission seeding completed. Updated: ${updated}, Skipped: ${skipped}`);
    
    return { updated, skipped };
  }

  /**
   * Update member permissions with enhanced validation and error handling
   * Supports updating collaboration, stock, payment, salary, sales, and purchase permissions independently or together
   */
  async updateMemberPermissions(
    businessId: string,
    userId: string,
    collaboration_permissions?: Record<string, boolean>,
    stock_permissions?: Record<string, boolean>,
    payment_permissions?: Record<string, boolean>,
    salary_permissions?: Record<string, boolean>,
    sales_permissions?: Record<string, boolean>,
    purchase_permissions?: Record<string, boolean>,
  ): Promise<BusinessMember> {
    // At least one permission field must be provided
    if (!collaboration_permissions && !stock_permissions && !payment_permissions && !salary_permissions && !sales_permissions && !purchase_permissions) {
      throw new BadRequestException(
        'At least one permission field (collaboration_permissions, stock_permissions, payment_permissions, salary_permissions, sales_permissions, or purchase_permissions) must be provided'
      );
    }

    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Find the member with business and user relations
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
      relations: ['user', 'business'],
    });

    if (!member) {
      throw new NotFoundException(
        `Business member not found for user ${userId} in business ${businessId}`
      );
    }

    // Validate that the member is active
    if (!member.is_active) {
      throw new BadRequestException('Cannot update permissions for inactive member');
    }

    // BUSINESS_OWNER permissions are immutable - they always have full access
    if (member.role === Role.BUSINESS_OWNER) {
      throw new ForbiddenException(
        'Cannot modify BUSINESS_OWNER permissions. Business owners always have full access to all features.'
      );
    }

    // Store previous permissions for logging
    const previousCollaborationPermissions = member.collaboration_permissions;
    const previousStockPermissions = member.stock_permissions;
    const previousPaymentPermissions = member.payment_permissions;
    const previousSalaryPermissions = member.salary_permissions;
    const previousSalesPermissions = member.sales_permissions;
    const previousPurchasePermissions = member.purchase_permissions;

    // Update collaboration permissions if provided
    if (collaboration_permissions) {
      member.collaboration_permissions = collaboration_permissions;
    }

    // Update stock permissions if provided
    if (stock_permissions) {
      member.stock_permissions = stock_permissions;
    }

    // Update payment permissions if provided
    if (payment_permissions) {
      member.payment_permissions = payment_permissions;
    }

    // Update salary permissions if provided
    if (salary_permissions) {
      member.salary_permissions = salary_permissions;
    }

    // Update sales permissions if provided
    if (sales_permissions) {
      member.sales_permissions = sales_permissions;
    }

    // Update purchase permissions if provided
    if (purchase_permissions) {
      member.purchase_permissions = purchase_permissions;
    }
    
    try {
      const updatedMember = await this.businessMemberRepository.save(member);
      
      console.log(`Permission update successful:`, {
        businessId,
        userId,
        memberRole: member.role,
        previousCollaborationPermissions,
        newCollaborationPermissions: member.collaboration_permissions,
        previousStockPermissions,
        newStockPermissions: member.stock_permissions,
        previousPaymentPermissions,
        newPaymentPermissions: member.payment_permissions,
        previousSalaryPermissions,
        newSalaryPermissions: member.salary_permissions,
        previousSalesPermissions,
        newSalesPermissions: member.sales_permissions,
        previousPurchasePermissions,
        newPurchasePermissions: member.purchase_permissions,
        updatedAt: new Date().toISOString()
      });

      return updatedMember;
    } catch (error) {
      console.error('Error updating member permissions:', error);
      throw new BadRequestException('Failed to update member permissions');
    }
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

  /**
   * Get user's collaboration permissions in a specific business
   */
  async getUserCollaborationPermissionsInBusiness(
    userId: string,
    businessId: string,
  ): Promise<Record<string, boolean> | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    // PLATFORM_ADMIN and BUSINESS_OWNER have all permissions
    if (user.role === Role.PLATFORM_ADMIN || user.role === Role.BUSINESS_OWNER) {
      return PermissionUtil.getRoleDefaultCollaborationPermissions(user.role);
    }

    // Check membership for permissions
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    return member?.collaboration_permissions || null;
  }

  /**
   * Get user's stock permissions in a specific business
   */
  async getUserStockPermissionsInBusiness(
    userId: string,
    businessId: string,
  ): Promise<Record<string, boolean> | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    // PLATFORM_ADMIN and BUSINESS_OWNER have all permissions
    if (user.role === Role.PLATFORM_ADMIN || user.role === Role.BUSINESS_OWNER) {
      return PermissionUtil.getRoleDefaultStockPermissions(user.role);
    }

    // Check membership for permissions
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    return member?.stock_permissions || null;
  }

  /**
   * Get user's payment permissions in a specific business
   */
  async getUserPaymentPermissionsInBusiness(
    userId: string,
    businessId: string,
  ): Promise<Record<string, boolean> | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    // PLATFORM_ADMIN and BUSINESS_OWNER have all permissions
    if (user.role === Role.PLATFORM_ADMIN || user.role === Role.BUSINESS_OWNER) {
      return PermissionUtil.getRoleDefaultPaymentPermissions(user.role);
    }

    // Check membership for permissions
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    return member?.payment_permissions || null;
  }

  /**
   * Validate if a user has a specific collaboration permission in a business
   */
  async validateUserCollaborationPermission(
    userId: string,
    businessId: string,
    permissionKey: string, // e.g., 'create_task', 'update_task'
  ): Promise<boolean> {
    const permissions = await this.getUserCollaborationPermissionsInBusiness(userId, businessId);
    
    if (!permissions) {
      return false;
    }

    return permissions[permissionKey] === true;
  }

  /**
   * Validate if a user has a specific stock permission in a business
   */
  async validateUserStockPermission(
    userId: string,
    businessId: string,
    permissionKey: string, // e.g., 'create_product', 'update_product'
  ): Promise<boolean> {
    const permissions = await this.getUserStockPermissionsInBusiness(userId, businessId);
    
    if (!permissions) {
      return false;
    }

    return permissions[permissionKey] === true;
  }

  /**
   * Validate if a user has a specific payment permission in a business
   */
  async validateUserPaymentPermission(
    userId: string,
    businessId: string,
    permissionKey: string, // e.g., 'create_client_payment', 'delete_supplier_payment'
  ): Promise<boolean> {
    const permissions = await this.getUserPaymentPermissionsInBusiness(userId, businessId);
    
    if (!permissions) {
      return false;
    }

    return permissions[permissionKey] === true;
  }

  /**
   * Get business member with full details including permissions
   */
  async getBusinessMemberDetails(
    businessId: string,
    userId: string,
  ): Promise<BusinessMember | null> {
    return this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId },
      relations: ['user', 'business'],
    });
  }

  /**
   * Bulk update permissions for multiple members (admin utility)
   */
  async bulkUpdatePermissions(
    businessId: string,
    updates: Array<{ 
      userId: string; 
      collaboration_permissions?: Record<string, boolean>;
      stock_permissions?: Record<string, boolean>;
      payment_permissions?: Record<string, boolean>;
    }>,
  ): Promise<{ updated: number; failed: number; errors: string[] }> {
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    for (const update of updates) {
      try {
        // Find and update member
        const member = await this.businessMemberRepository.findOne({
          where: { business_id: businessId, user_id: update.userId },
        });

        if (!member) {
          errors.push(`Member not found: ${update.userId}`);
          failed++;
          continue;
        }

        if (update.collaboration_permissions) {
          member.collaboration_permissions = update.collaboration_permissions;
        }
        
        if (update.stock_permissions) {
          member.stock_permissions = update.stock_permissions;
        }

        if (update.payment_permissions) {
          member.payment_permissions = update.payment_permissions;
        }
        
        await this.businessMemberRepository.save(member);
        updated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error updating user ${update.userId}: ${errorMessage}`);
        failed++;
      }
    }

    console.log(`Bulk permission update completed:`, {
      businessId,
      totalRequests: updates.length,
      updated,
      failed,
      errors: errors.length
    });

    return { updated, failed, errors };
  }
}
