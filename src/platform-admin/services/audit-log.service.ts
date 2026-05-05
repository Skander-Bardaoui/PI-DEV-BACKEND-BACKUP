// src/platform-admin/services/audit-log.service.ts
import { Injectable, Scope, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

@Injectable({ scope: Scope.REQUEST })
export class AuditLogService {
  constructor(
    @InjectRepository(PlatformAuditLog)
    private readonly auditLogRepo: Repository<PlatformAuditLog>,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  async auditLog(
    action: string,
    targetType?: string,
    targetId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const adminId = this.request.user?.id;
    const ipAddress = this.request.ip || this.request.connection?.remoteAddress || 'unknown';

    if (!adminId) {
      return; // Skip if no admin context
    }

    await this.auditLogRepo.save({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
      ip_address: ipAddress,
    });
  }

  async getAuditLogs(query: AuditLogQueryDto) {
    const { action, targetType, startDate, endDate, page = 1, limit = 50 } = query;

    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.admin', 'admin')
      .orderBy('log.created_at', 'DESC');

    if (action) {
      qb.andWhere('log.action = :action', { action });
    }

    if (targetType) {
      qb.andWhere('log.target_type = :targetType', { targetType });
    }

    if (startDate && endDate) {
      qb.andWhere('log.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('log.created_at >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('log.created_at <= :endDate', { endDate });
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [logs, total] = await qb.getManyAndCount();

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
