// src/common/controllers/audit-logs.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { AuditLogService } from '../services/audit-log.service';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';

@Controller('businesses/:businessId/audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getBusinessLogs(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('action') action?: AuditAction,
    @Query('entity_type') entityType?: AuditEntityType,
    @Query('performed_by', new ParseUUIDPipe({ optional: true })) performedBy?: string,
  ) {
    return this.auditLogService.getBusinessLogs(businessId, page, limit, {
      action,
      entity_type: entityType,
      performed_by: performedBy,
    });
  }

  @Get('entity/:entityType/:entityId')
  async getEntityLogs(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.auditLogService.getEntityLogs(businessId, entityType, entityId);
  }

  @Get('recent')
  async getRecentActivity(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.auditLogService.getRecentActivity(businessId, limit);
  }
}
