// src/platform-admin/dto/system-health.dto.ts
export class SystemHealthDto {
  database: 'ok' | 'degraded';
  dbResponseMs: number;
  totalTenants: number;
  activeConnections: number;
  uptime: number;
}
