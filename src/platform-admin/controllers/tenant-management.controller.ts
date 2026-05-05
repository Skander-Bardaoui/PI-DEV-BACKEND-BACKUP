// src/platform-admin/controllers/tenant-management.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { TenantManagementService } from '../services/tenant-management.service';
import { TenantQueryDto } from '../dto/tenant-query.dto';
import { RejectTenantDto } from '../dto/reject-tenant.dto';
import { SuspendTenantDto } from '../dto/suspend-tenant.dto';

@Controller('platform/tenants')
@UseGuards(PlatformAdminGuard)
export class TenantManagementController {
  constructor(private readonly tenantService: TenantManagementService) {}

  // ─── List Tenants ────────────────────────────────────────────────────────
  @Get()
  async listTenants(@Query() query: TenantQueryDto) {
    return this.tenantService.listTenants(query);
  }

  // ─── Get Tenant Detail ───────────────────────────────────────────────────
  @Get(':id')
  async getTenantDetail(@Param('id') id: string) {
    return this.tenantService.getTenantDetail(id);
  }

  // ─── Approve Tenant ──────────────────────────────────────────────────────
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveTenant(@Param('id') id: string, @Request() req: any) {
    return this.tenantService.approveTenant(id, req.user.id);
  }

  // ─── Reject Tenant ───────────────────────────────────────────────────────
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectTenant(
    @Param('id') id: string,
    @Body() dto: RejectTenantDto,
    @Request() req: any,
  ) {
    return this.tenantService.rejectTenant(id, req.user.id, dto);
  }

  // ─── Suspend Tenant ──────────────────────────────────────────────────────
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendTenant(@Param('id') id: string, @Body() dto: SuspendTenantDto) {
    return this.tenantService.suspendTenant(id, dto.reason);
  }

  // ─── Unsuspend Tenant ────────────────────────────────────────────────────
  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspendTenant(@Param('id') id: string) {
    return this.tenantService.unsuspendTenant(id);
  }

  // ─── Export Tenant Data ──────────────────────────────────────────────────
  @Get(':id/export')
  async exportTenantData(
    @Param('id') id: string,
    @Query('format') format?: 'json' | 'csv' | 'excel' | 'sql',
  ) {
    return this.tenantService.exportTenantData(id, format || 'json');
  }

  // ─── Delete Tenant (Secure with Password + Export) ──────────────────────
  @Post(':id/delete-secure')
  @HttpCode(HttpStatus.OK)
  async deleteTenantSecure(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    console.log('[Controller] Secure delete request received');
    console.log('[Controller] Tenant ID:', id);
    console.log('[Controller] User from request:', req.user);
    console.log('[Controller] Body:', body);
    
    const { adminPassword, exportToken } = body || {};
    
    if (!adminPassword || !exportToken) {
      console.log('[Controller] Missing required fields');
      throw new BadRequestException({
        message: 'Admin password and export token are required',
        received: {
          hasAdminPassword: !!adminPassword,
          hasExportToken: !!exportToken,
          bodyKeys: Object.keys(body || {}),
        }
      });
    }
    
    console.log('[Controller] Calling service with admin ID:', req.user.id);
    return this.tenantService.deleteTenantSecure(id, req.user.id, adminPassword, exportToken);
  }

  // ─── Delete Tenant (Legacy - kept for backward compatibility) ────────────
  @Delete(':id')
  async deleteTenant(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    console.log('[Controller] Delete request received (legacy endpoint)');
    console.log('[Controller] Request method:', req.method);
    console.log('[Controller] Request body:', req.body);
    console.log('[Controller] Body param:', body);
    console.log('[Controller] adminPassword:', body?.adminPassword);
    console.log('[Controller] exportToken:', body?.exportToken);
    console.log('[Controller] Keys in body:', Object.keys(body || {}));
    
    const { adminPassword, exportToken } = body || {};
    
    if (!adminPassword || !exportToken) {
      console.log('[Controller] Missing required fields');
      throw new BadRequestException({
        message: 'Admin password and export token are required',
        received: {
          hasAdminPassword: !!adminPassword,
          hasExportToken: !!exportToken,
          bodyKeys: Object.keys(body || {}),
        }
      });
    }
    return this.tenantService.deleteTenantSecure(id, req.user.id, adminPassword, exportToken);
  }

  // ─── Impersonate Tenant ──────────────────────────────────────────────────
  @Post(':id/impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonateTenant(@Param('id') id: string, @Request() req: any) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.tenantService.impersonateTenant(id, req.user.id, ip, userAgent);
  }
}