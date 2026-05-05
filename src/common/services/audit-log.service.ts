// src/common/services/audit-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditEntityType } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  business_id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name?: string;
  performed_by: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  description?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an audit log entry
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(dto);
    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(
    businessId: string,
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        business_id: businessId,
        entity_type: entityType,
        entity_id: entityId,
      },
      order: { created_at: 'DESC' },
      take: 100, // Limit to last 100 logs
    });
  }

  /**
   * Get audit logs for a business (with pagination)
   */
  async getBusinessLogs(
    businessId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      action?: AuditAction;
      entity_type?: AuditEntityType;
      performed_by?: string;
      start_date?: Date;
      end_date?: Date;
    },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .where('audit_log.business_id = :businessId', { businessId });

    if (filters?.action) {
      queryBuilder.andWhere('audit_log.action = :action', { action: filters.action });
    }

    if (filters?.entity_type) {
      queryBuilder.andWhere('audit_log.entity_type = :entityType', {
        entityType: filters.entity_type,
      });
    }

    if (filters?.performed_by) {
      queryBuilder.andWhere('audit_log.performed_by = :performedBy', {
        performedBy: filters.performed_by,
      });
    }

    if (filters?.start_date) {
      queryBuilder.andWhere('audit_log.created_at >= :startDate', {
        startDate: filters.start_date,
      });
    }

    if (filters?.end_date) {
      queryBuilder.andWhere('audit_log.created_at <= :endDate', {
        endDate: filters.end_date,
      });
    }

    const [logs, total] = await queryBuilder
      .orderBy('audit_log.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { logs, total };
  }

  /**
   * Get recent activity for dashboard
   */
  async getRecentActivity(businessId: string, limit: number = 20): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get user activity
   */
  async getUserActivity(
    businessId: string,
    userId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        business_id: businessId,
        performed_by: userId,
      },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
