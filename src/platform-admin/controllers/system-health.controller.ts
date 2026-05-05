// src/platform-admin/controllers/system-health.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { SystemHealthService } from '../services/system-health.service';

@Controller('platform/system')
@UseGuards(PlatformAdminGuard)
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  @Get('health')
  async getSystemHealth() {
    return this.systemHealthService.getSystemHealth();
  }
}
