// src/platform-admin/services/system-health.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { SystemHealthDto } from '../dto/system-health.dto';

@Injectable()
export class SystemHealthService {
  private readonly startTime: number;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {
    this.startTime = Date.now();
  }

  async getSystemHealth(): Promise<SystemHealthDto> {
    const startQuery = Date.now();
    
    try {
      // Simple query to test database responsiveness
      await this.tenantRepo.count();
      const dbResponseMs = Date.now() - startQuery;

      // Get total tenants
      const totalTenants = await this.tenantRepo.count();

      // Get active connections (PostgreSQL specific)
      let activeConnections = 0;
      try {
        const result = await this.dataSource.query(
          'SELECT count(*) as count FROM pg_stat_activity WHERE state = $1',
          ['active'],
        );
        activeConnections = parseInt(result[0]?.count || '0', 10);
      } catch (error) {
        // If query fails, just use 0
        activeConnections = 0;
      }

      // Calculate uptime in seconds
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      // Determine database status
      const database: 'ok' | 'degraded' = dbResponseMs < 1000 ? 'ok' : 'degraded';

      return {
        database,
        dbResponseMs,
        totalTenants,
        activeConnections,
        uptime,
      };
    } catch (error) {
      // If database is completely unreachable
      return {
        database: 'degraded',
        dbResponseMs: Date.now() - startQuery,
        totalTenants: 0,
        activeConnections: 0,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      };
    }
  }
}
