// src/platform-admin/services/tenant-management.service.ts
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, Not, In, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantApproval } from '../entities/tenant-approval.entity';
import { Subscription } from '../entities/subscription.entity';
import { ImpersonationLog } from '../entities/impersonation-log.entity';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TenantExportToken } from '../entities/tenant-export-token.entity';
import { User } from '../../users/entities/user.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { Business } from '../../businesses/entities/business.entity';
import { PlatformAdmin } from '../../platform-auth/entities/platform-admin.entity';
import { EmailService } from '../../email/email.service';
import { TenantQueryDto } from '../dto/tenant-query.dto';
import { RejectTenantDto } from '../dto/reject-tenant.dto';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Injectable()
export class TenantManagementService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantApproval)
    private readonly approvalRepo: Repository<TenantApproval>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(ImpersonationLog)
    private readonly impersonationLogRepo: Repository<ImpersonationLog>,
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepo: Repository<SupportTicket>,
    @InjectRepository(TenantExportToken)
    private readonly exportTokenRepo: Repository<TenantExportToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BusinessMember)
    private readonly businessMemberRepo: Repository<BusinessMember>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(PlatformAdmin)
    private readonly platformAdminRepo: Repository<PlatformAdmin>,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── List Tenants ────────────────────────────────────────────────────────
  async listTenants(query: TenantQueryDto) {
    try {
      const { page = 1, limit = 20, search, status, planSlug } = query;

      // Get all tenants with owner
      let allTenants = await this.tenantRepo.find({
        where: { deleted_at: IsNull() },
        relations: ['owner'],
        order: {
          createdAt: 'DESC',
        },
      });

      // Apply search filter in memory
      if (search) {
        const searchLower = search.toLowerCase();
        allTenants = allTenants.filter(tenant => 
          tenant.name?.toLowerCase().includes(searchLower) ||
          tenant.owner?.email?.toLowerCase().includes(searchLower) ||
          tenant.owner?.firstName?.toLowerCase().includes(searchLower) ||
          tenant.owner?.lastName?.toLowerCase().includes(searchLower)
        );
      }

      // Get additional data for each tenant
      const tenantsWithData = await Promise.all(
        allTenants.map(async (tenant) => {
          // Get approval
          const approval = await this.approvalRepo.findOne({
            where: { tenant_id: tenant.id },
          });

          // Get subscription
          const subscription = await this.subscriptionRepo.findOne({
            where: { tenant_id: tenant.id },
            relations: ['plan'],
          });

          // Get counts
          const businessCount = await this.businessRepo.count({
            where: { tenant_id: tenant.id },
          });

          let memberCount = 0;
          try {
            const businesses = await this.businessRepo.find({
              where: { tenant_id: tenant.id },
              select: ['id'],
            });
            
            if (businesses.length > 0) {
              const businessIds = businesses.map(b => b.id);
              for (const businessId of businessIds) {
                const count = await this.businessMemberRepo.count({
                  where: { business_id: businessId },
                });
                memberCount += count;
              }
            }
          } catch (err) {
            console.error('Error counting members:', err);
          }

          // Determine overall status
          let overallStatus = 'inactive';
          if (approval?.status === ApprovalStatus.PENDING) {
            overallStatus = 'pending';
          } else if (approval?.status === ApprovalStatus.REJECTED) {
            overallStatus = 'rejected';
          } else if (approval?.status === ApprovalStatus.APPROVED) {
            if (subscription?.status === SubscriptionStatus.SUSPENDED) {
              overallStatus = 'suspended';
            } else if (subscription?.status === SubscriptionStatus.ACTIVE || subscription?.status === SubscriptionStatus.TRIAL) {
              overallStatus = 'active';
            }
          }

          return {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            owner: tenant.owner,
            approval,
            subscription,
            memberCount,
            businessCount,
            status: overallStatus,
            billingPlan: subscription?.plan?.name || 'Free',
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
          };
        })
      );

      // Apply status filter
      let filteredTenants = tenantsWithData;
      if (status) {
        filteredTenants = filteredTenants.filter(t => t.status === status);
      }

      // Apply plan filter
      if (planSlug) {
        filteredTenants = filteredTenants.filter(t => t.subscription?.plan?.slug === planSlug);
      }

      // Pagination
      const total = filteredTenants.length;
      const skip = (page - 1) * limit;
      const paginatedTenants = filteredTenants.slice(skip, skip + limit);

      return {
        data: paginatedTenants,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in listTenants:', error);
      throw error;
    }
  }

  // ─── Get Tenant Detail ───────────────────────────────────────────────────
  async getTenantDetail(id: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const approval = await this.approvalRepo.findOne({
      where: { tenant_id: id },
      relations: ['reviewed_by'],
    });

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: id },
      relations: ['plan'],
    });

    const businesses = await this.businessRepo.find({
      where: { tenant_id: id },
    });

    const memberCount = await this.businessMemberRepo.count({
      where: { business: { tenant_id: id } },
    });

    // Determine overall status (same logic as listTenants)
    let overallStatus = 'inactive';
    if (approval?.status === ApprovalStatus.PENDING) {
      overallStatus = 'pending';
    } else if (approval?.status === ApprovalStatus.REJECTED) {
      overallStatus = 'rejected';
    } else if (approval?.status === ApprovalStatus.APPROVED) {
      if (subscription?.status === SubscriptionStatus.SUSPENDED) {
        overallStatus = 'suspended';
      } else if (subscription?.status === SubscriptionStatus.ACTIVE || subscription?.status === SubscriptionStatus.TRIAL) {
        overallStatus = 'active';
      }
    }

    return {
      ...tenant,
      approval,
      subscription,
      businesses,
      memberCount,
      status: overallStatus, // Add the calculated status
    };
  }

  // ─── Approve Tenant ──────────────────────────────────────────────────────
  async approveTenant(tenantId: string, adminId: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const approval = await this.approvalRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!approval) {
      throw new NotFoundException('Tenant approval record not found');
    }

    if (approval.status === ApprovalStatus.APPROVED) {
      throw new BadRequestException('Tenant is already approved');
    }

    approval.status = ApprovalStatus.APPROVED;
    approval.reviewed_by_id = adminId;
    approval.reviewed_at = new Date();
    await this.approvalRepo.save(approval);

    // Get subscription to check payment status
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['plan'],
    });

    if (subscription) {
      // Check if subscription is already paid
      if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIAL) {
        // Already paid or in trial - tenant can access immediately
        return { 
          message: 'Tenant approved successfully. Subscription is active.',
          requiresPayment: false
        };
      }

      // Subscription not paid yet - send payment link email
      if (subscription.payment_token) {
        // Calculate amount based on billing cycle
        const amount =
          subscription.billing_cycle === 'monthly'
            ? subscription.plan.price_monthly
            : subscription.plan.price_annual;

        // Send approval email with payment link
        await this.emailService.sendTenantApprovalEmail(
         tenant.owner.email, // Send to business owner email
          tenant.name,
          subscription.plan.name,
          subscription.billing_cycle,
          amount,
          subscription.payment_token,
        );

        return { 
          message: 'Tenant approved successfully. Payment link sent to tenant email.',
          requiresPayment: true
        };
      }
    }

    return { 
      message: 'Tenant approved successfully',
      requiresPayment: false
    };
  }

  // ─── Reject Tenant ───────────────────────────────────────────────────────
  async rejectTenant(tenantId: string, adminId: string, dto: RejectTenantDto) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const approval = await this.approvalRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!approval) {
      throw new NotFoundException('Tenant approval record not found');
    }

    approval.status = ApprovalStatus.REJECTED;
    approval.reviewed_by_id = adminId;
    approval.reviewed_at = new Date();
    approval.rejection_reason = dto.reason;
    await this.approvalRepo.save(approval);

    // Send rejection email
    const fullName = `${tenant.owner.firstName} ${tenant.owner.lastName}`;
    await this.emailService.sendTenantRejectionEmail(tenant.owner.email, fullName, dto.reason);

    return { message: 'Tenant rejected successfully' };
  }

  // ─── Suspend Tenant ──────────────────────────────────────────────────────
  async suspendTenant(tenantId: string, reason?: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Suspend subscription
    subscription.status = SubscriptionStatus.SUSPENDED;
    subscription.suspended_at = new Date();
    if (reason) {
      subscription.notes = reason;
    }
    await this.subscriptionRepo.save(subscription);

    // Suspend all businesses under this tenant
    await this.businessRepo
      .createQueryBuilder()
      .update(Business)
      .set({
        is_suspended: true,
        suspended_at: new Date(),
        suspension_reason: reason || 'Tenant suspended by platform admin',
      })
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // Get all businesses under this tenant first
    const businesses = await this.businessRepo.find({
      where: { tenant_id: tenantId },
      select: ['id'],
    });

    const businessIds = businesses.map(b => b.id);

    if (businessIds.length > 0) {
      // Suspend all business members under this tenant (in business_members table)
      await this.businessMemberRepo
        .createQueryBuilder()
        .update(BusinessMember)
        .set({ is_active: false })
        .where('business_id IN (:...businessIds)', { businessIds })
        .execute();

      // Get all user IDs from business members
      const businessMembers = await this.businessMemberRepo.find({
        where: { business_id: In(businessIds) },
        select: ['user_id'],
      });

      const userIds = businessMembers.map(bm => bm.user_id);

      // Suspend all users who are members of businesses under this tenant (in users table)
      if (userIds.length > 0) {
        await this.userRepo
          .createQueryBuilder()
          .update(User)
          .set({ is_suspended: true })
          .where('id IN (:...userIds)', { userIds })
          .execute();
      }
    }

    return { message: 'Tenant, all businesses, and all business members suspended successfully' };
  }

  // ─── Unsuspend Tenant ────────────────────────────────────────────────────
  async unsuspendTenant(tenantId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Unsuspend subscription
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.suspended_at = undefined;
    await this.subscriptionRepo.save(subscription);

    // Unsuspend all businesses under this tenant
    await this.businessRepo
      .createQueryBuilder()
      .update(Business)
      .set({
        is_suspended: false,
        suspended_at: undefined,
        suspension_reason: undefined,
      })
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // Get all businesses under this tenant first
    const businesses = await this.businessRepo.find({
      where: { tenant_id: tenantId },
      select: ['id'],
    });

    const businessIds = businesses.map(b => b.id);

    if (businessIds.length > 0) {
      // Reactivate all business members under this tenant (in business_members table)
      await this.businessMemberRepo
        .createQueryBuilder()
        .update(BusinessMember)
        .set({ is_active: true })
        .where('business_id IN (:...businessIds)', { businessIds })
        .execute();

      // Get all user IDs from business members
      const businessMembers = await this.businessMemberRepo.find({
        where: { business_id: In(businessIds) },
        select: ['user_id'],
      });

      const userIds = businessMembers.map(bm => bm.user_id);

      // Unsuspend all users who are members of businesses under this tenant (in users table)
      if (userIds.length > 0) {
        await this.userRepo
          .createQueryBuilder()
          .update(User)
          .set({ is_suspended: false })
          .where('id IN (:...userIds)', { userIds })
          .execute();
      }
    }

    return { message: 'Tenant, all businesses, and all business members unsuspended successfully' };
  }

  // ─── Delete Tenant (Hard Delete - Complete Removal) ─────────────────────────────────────────
  async deleteTenant(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Get all businesses under this tenant
    const businesses = await this.businessRepo.find({
      where: { tenant_id: tenantId },
      select: ['id'],
    });

    const businessIds = businesses.map(b => b.id);
    let deletedMembersCount = 0;
    let deletedUsersCount = 0;

    if (businessIds.length > 0) {
      // Get all user IDs associated with these businesses (including business members)
      const businessMembers = await this.businessMemberRepo.find({
        where: { business_id: In(businessIds) },
        select: ['user_id', 'id'],
      });

      const userIds = [...new Set(businessMembers.map(bm => bm.user_id))]; // Remove duplicates
      deletedMembersCount = businessMembers.length;

      // HARD DELETE all business members
      await this.businessMemberRepo
        .createQueryBuilder()
        .delete()
        .from(BusinessMember)
        .where('business_id IN (:...businessIds)', { businessIds })
        .execute();

      // HARD DELETE all users who are members of these businesses
      if (userIds.length > 0) {
        await this.userRepo
          .createQueryBuilder()
          .delete()
          .from(User)
          .where('id IN (:...userIds)', { userIds })
          .execute();
        
        deletedUsersCount = userIds.length;
      }

      // HARD DELETE all businesses under this tenant
      // Note: Due to CASCADE delete constraints, this will automatically delete:
      // - Products, Warehouses, Stock Movements, Product Categories
      // - Suppliers, Purchase Orders, Purchase Invoices, Goods Receipts
      // - Clients, Quotes, Sales Orders, Invoices, Delivery Notes
      // - Accounts, Transactions, Payments
      // - Business Settings, Tax Rates, Audit Logs
      // - All portal tokens and other related data
      await this.businessRepo
        .createQueryBuilder()
        .delete()
        .from(Business)
        .where('tenant_id = :tenantId', { tenantId })
        .execute();
    }

    // HARD DELETE the tenant owner (business owner)
    // IMPORTANT: Must be done AFTER deleting the tenant to avoid FK constraint
    const ownerId = tenant.ownerId;

    // HARD DELETE tenant approval record
    await this.approvalRepo
      .createQueryBuilder()
      .delete()
      .from(TenantApproval)
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // HARD DELETE subscription record
    await this.subscriptionRepo
      .createQueryBuilder()
      .delete()
      .from(Subscription)
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // HARD DELETE impersonation logs
    await this.impersonationLogRepo
      .createQueryBuilder()
      .delete()
      .from(ImpersonationLog)
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // HARD DELETE support tickets
    await this.supportTicketRepo
      .createQueryBuilder()
      .delete()
      .from(SupportTicket)
      .where('tenant_id = :tenantId', { tenantId })
      .execute();

    // CRITICAL FIX: Delete the tenant record FIRST (this removes the FK reference to the owner)
    console.log(`[Delete] Deleting tenant record...`);
    await this.tenantRepo
      .createQueryBuilder()
      .delete()
      .from(Tenant)
      .where('id = :tenantId', { tenantId })
      .execute();
    console.log(`[Delete] ✅ Tenant record deleted`);

    // NOW delete the owner user (after tenant is deleted, so no FK constraint)
    if (ownerId) {
      console.log(`[Delete] Deleting tenant owner user (ID: ${ownerId})...`);
      try {
        await this.userRepo
          .createQueryBuilder()
          .delete()
          .from(User)
          .where('id = :ownerId', { ownerId })
          .execute();
        console.log(`[Delete] ✅ Tenant owner deleted`);
      } catch (error) {
        console.log(`[Delete] ⚠️ Owner user might have been already deleted or doesn't exist`);
        // Continue - owner might have been deleted as part of business members
      }
    }

    return { 
      message: 'Tenant and all related data permanently deleted from database',
      deletedBusinesses: businessIds.length,
      deletedMembers: deletedMembersCount,
      deletedUsers: deletedUsersCount,
      note: 'All related data (products, invoices, orders, payments, etc.) has been cascade deleted'
    };
  }

  // ─── Impersonate Tenant ──────────────────────────────────────────────────
  async impersonateTenant(tenantId: string, adminId: string, ip: string, userAgent?: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Find the business owner user
    const owner = tenant.owner;

    if (!owner) {
      throw new NotFoundException('Tenant owner not found');
    }

    // Find business_id for the owner
    const business = await this.businessRepo.findOne({
      where: { tenant_id: tenantId },
      order: { created_at: 'ASC' },
    });

    // Generate short-lived impersonation token (1 hour)
    const payload = {
      sub: owner.id,
      email: owner.email,
      role: owner.role,
      business_id: business?.id || null,
      impersonated_by: adminId,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '1h',
    });

    // Log impersonation
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.impersonationLogRepo.save({
      admin_id: adminId,
      tenant_id: tenantId,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
    });

    return {
      token,
      user: {
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        role: owner.role,
      },
      expiresAt,
    };
  }

  // ─── Export Tenant Data ──────────────────────────────────────────────────
  async exportTenantData(tenantId: string, format: 'json' | 'csv' | 'excel' | 'sql' = 'json') {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Get all related data (ONLY TENANT METADATA - NO CONFIDENTIAL BUSINESS DATA)
    const businesses = await this.businessRepo.find({
      where: { tenant_id: tenantId },
      select: ['id', 'name', 'email', 'phone', 'tax_id', 'currency', 'is_suspended', 'created_at'],
    });

    const businessIds = businesses.map(b => b.id);

    // Get all business members (ONLY MEMBERSHIP INFO - NO BUSINESS DATA)
    let businessMembers: BusinessMember[] = [];
    let users: User[] = [];
    if (businessIds.length > 0) {
      businessMembers = await this.businessMemberRepo.find({
        where: { business_id: In(businessIds) },
        select: ['id', 'business_id', 'user_id', 'role', 'is_active', 'joined_at', 'created_at'],
      });

      const userIds = [...new Set(businessMembers.map(bm => bm.user_id))];
      if (userIds.length > 0) {
        users = await this.userRepo.find({
          where: { id: In(userIds) },
          select: ['id', 'email', 'firstName', 'lastName', 'role', 'phone', 'jobTitle', 'is_verified', 'is_suspended', 'created_at'],
        });
      }
    }

    // Get subscription and approval
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['plan'],
    });

    const approval = await this.approvalRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['reviewed_by'],
    });

    const supportTickets = await this.supportTicketRepo.find({
      where: { tenant_id: tenantId },
      select: ['id', 'subject', 'status', 'priority', 'created_at'],
    });

    // Generate export token (valid for 30 minutes)
    const exportToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    console.log(`[Export] ========== GENERATING EXPORT TOKEN ==========`);
    console.log(`[Export] Tenant ID: ${tenantId}`);
    console.log(`[Export] Token: ${exportToken}`);
    console.log(`[Export] Expires at: ${expiresAt.toISOString()}`);

    // Save token to database
    try {
      const savedToken = await this.exportTokenRepo.save({
        tenant_id: tenantId,
        token: exportToken,
        expires_at: expiresAt,
      });
      console.log(`[Export] ✅ Token saved to database successfully`);
      console.log(`[Export] Saved token ID: ${savedToken.id}`);
    } catch (err: any) {
      console.error(`[Export] ❌ Failed to save token to database:`, err?.message);
      throw err;
    }

    // Clean up expired tokens
    await this.cleanupExpiredTokens();

    console.log(`[Export] ========== EXPORT TOKEN READY ==========`);

    // Prepare export data (ONLY TENANT METADATA)
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportToken,
      format,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        status: tenant.status,
        billingPlan: tenant.billingPlan,
        contactEmail: tenant.contactEmail,
        description: tenant.description,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        owner: tenant.owner ? {
          id: tenant.owner.id,
          email: tenant.owner.email,
          firstName: tenant.owner.firstName,
          lastName: tenant.owner.lastName,
          role: tenant.owner.role,
          phone: tenant.owner.phone,
        } : null,
      },
      approval: approval ? {
        status: approval.status,
        reviewed_at: approval.reviewed_at,
        rejection_reason: approval.rejection_reason,
        reviewed_by: approval.reviewed_by ? {
          email: approval.reviewed_by.email,
        } : null,
      } : null,
      subscription: subscription ? {
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_ends_at: subscription.trial_ends_at,
        cancelled_at: subscription.cancelled_at,
        suspended_at: subscription.suspended_at,
        plan: subscription.plan ? {
          name: subscription.plan.name,
          slug: subscription.plan.slug,
          price_monthly: subscription.plan.price_monthly,
          price_annual: subscription.plan.price_annual,
        } : null,
      } : null,
      businesses: businesses.map(b => ({
        id: b.id,
        name: b.name,
        tax_id: b.tax_id,
        email: b.email,
        phone: b.phone,
        currency: b.currency,
        is_suspended: b.is_suspended,
        created_at: b.created_at,
      })),
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        jobTitle: u.jobTitle,
        is_verified: u.is_verified,
        is_suspended: u.is_suspended,
        created_at: u.created_at,
      })),
      businessMembers: businessMembers.map(bm => ({
        id: bm.id,
        business_id: bm.business_id,
        user_id: bm.user_id,
        role: bm.role,
        is_active: bm.is_active,
        joined_at: bm.joined_at,
        created_at: bm.created_at,
      })),
      supportTickets: supportTickets.map(st => ({
        id: st.id,
        subject: st.subject,
        status: st.status,
        priority: st.priority,
        created_at: st.created_at,
      })),
      statistics: {
        totalBusinesses: businesses.length,
        totalUsers: users.length,
        totalMembers: businessMembers.length,
        totalSupportTickets: supportTickets.length,
      },
    };

    return {
      message: 'Tenant data exported successfully',
      exportToken,
      expiresAt,
      format,
      data: exportData,
    };
  }

  // ─── Verify Admin Password ───────────────────────────────────────────────
  async verifyAdminPassword(adminId: string, password: string): Promise<boolean> {
    console.log(`[VerifyPassword] Looking up admin with ID: ${adminId}`);
    
    const admin = await this.platformAdminRepo.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      console.log(`[VerifyPassword] Admin not found with ID: ${adminId}`);
      throw new NotFoundException('Admin not found');
    }

    console.log(`[VerifyPassword] Admin found: ${admin.email}`);
    console.log(`[VerifyPassword] Has password hash: ${!!admin.password_hash}`);
    
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    console.log(`[VerifyPassword] Password valid: ${isPasswordValid}`);
    
    return isPasswordValid;
  }

  // ─── Verify Export Token ─────────────────────────────────────────────────
  private async verifyExportToken(exportToken: string, tenantId: string): Promise<boolean> {
    console.log(`[Delete] Verifying token ${exportToken} for tenant ${tenantId}`);
    
    const tokenRecord = await this.exportTokenRepo.findOne({
      where: { token: exportToken },
    });

    if (!tokenRecord) {
      console.log(`[Delete] Token not found in database`);
      return false;
    }

    // Check if token is expired
    const now = new Date();
    if (now > tokenRecord.expires_at) {
      console.log(`[Delete] Token expired. Now: ${now.toISOString()}, Expires: ${tokenRecord.expires_at.toISOString()}`);
      await this.exportTokenRepo.delete({ id: tokenRecord.id });
      return false;
    }

    // Check if token matches tenant
    if (tokenRecord.tenant_id !== tenantId) {
      console.log(`[Delete] Token tenant mismatch. Expected: ${tenantId}, Got: ${tokenRecord.tenant_id}`);
      return false;
    }

    console.log(`[Delete] Token verified successfully`);
    return true;
  }

  // ─── Clean Up Expired Tokens ─────────────────────────────────────────────
  private async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    await this.exportTokenRepo.delete({
      expires_at: LessThan(now),
    });
  }

  // ─── Delete Tenant with Security (Password + Export Required) ────────────
  async deleteTenantSecure(tenantId: string, adminId: string, adminPassword: string, exportToken: string) {
    try {
      console.log(`[Delete] ========== STARTING SECURE DELETE ==========`);
      console.log(`[Delete] Tenant ID: ${tenantId}`);
      console.log(`[Delete] Admin ID: ${adminId}`);
      console.log(`[Delete] Password provided: ${!!adminPassword} (length: ${adminPassword?.length})`);
      console.log(`[Delete] Token provided: ${!!exportToken} (length: ${exportToken?.length})`);
      console.log(`[Delete] Token value: ${exportToken}`);
      
      // 1. Verify admin password
      console.log(`[Delete] Step 1: Verifying admin password...`);
      let isPasswordValid = false;
      try {
        isPasswordValid = await this.verifyAdminPassword(adminId, adminPassword);
      } catch (err: any) {
        console.error(`[Delete] Password verification error:`, err?.message);
        console.error(`[Delete] Error stack:`, err?.stack);
        throw err;
      }
      
      if (!isPasswordValid) {
        console.log(`[Delete] ❌ Invalid password for admin ${adminId}`);
        throw new UnauthorizedException('Invalid admin password');
      }
      console.log(`[Delete] ✅ Password verified successfully`);

      // 2. Verify export token
      console.log(`[Delete] Step 2: Verifying export token...`);
      console.log(`[Delete] Looking for token in database: ${exportToken}`);
      
      // Check if token exists in database
      const tokenRecord = await this.exportTokenRepo.findOne({
        where: { token: exportToken },
      });
      
      console.log(`[Delete] Token record found:`, tokenRecord ? 'YES' : 'NO');
      if (tokenRecord) {
        console.log(`[Delete] Token details:`, {
          id: tokenRecord.id,
          tenant_id: tokenRecord.tenant_id,
          expires_at: tokenRecord.expires_at,
          created_at: tokenRecord.created_at,
        });
      }
      
      const isExportValid = await this.verifyExportToken(exportToken, tenantId);
      if (!isExportValid) {
        console.log(`[Delete] ❌ Export token validation failed`);
        
        // List all tokens for this tenant for debugging
        const allTokens = await this.exportTokenRepo.find({
          where: { tenant_id: tenantId },
        });
        console.log(`[Delete] All tokens for tenant ${tenantId}:`, allTokens);
        
        throw new BadRequestException('Invalid or expired export token. Please export tenant data again.');
      }
      console.log(`[Delete] ✅ Export token verified successfully`);

      // 3. Delete the export token (one-time use)
      console.log(`[Delete] Step 3: Deleting export token...`);
      await this.exportTokenRepo.delete({ token: exportToken });
      console.log(`[Delete] ✅ Export token deleted (one-time use)`);

      // 4. Proceed with deletion
      console.log(`[Delete] Step 4: Proceeding with tenant deletion...`);
      const result = await this.deleteTenant(tenantId);
      console.log(`[Delete] ✅ Tenant deleted successfully`);
      console.log(`[Delete] ========== DELETE COMPLETED ==========`);
      return result;
    } catch (error: any) {
      console.error(`[Delete] ========== DELETE FAILED ==========`);
      console.error(`[Delete] Error:`, error?.message);
      console.error(`[Delete] Stack:`, error?.stack);
      throw error;
    }
  }
}

