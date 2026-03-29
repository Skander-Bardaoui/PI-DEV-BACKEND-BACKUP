// src/Purchases/controllers/purchase-alerts.controller.ts
import {
  Controller, Get, Patch, Post, Param, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { AuthGuard }              from '@nestjs/passport';
import { PurchaseAlertsService }  from '../services/purchase-alerts.service';
import { AlertStatus } from '../enum/alertStatus';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/purchase-alerts')
export class PurchaseAlertsController {

  constructor(private readonly svc: PurchaseAlertsService) {}

  // GET /businesses/:businessId/purchase-alerts
  @Get()
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('status') status?: AlertStatus,
  ) {
    return this.svc.findAll(businessId, status);
  }

  // GET /businesses/:businessId/purchase-alerts/count
  @Get('count')
  getCount(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.svc.getUnreadCount(businessId).then(count => ({ count }));
  }

  // PATCH /businesses/:businessId/purchase-alerts/:id/read
  @Patch(':id/read')
  markAsRead(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id',         ParseUUIDPipe) id:         string,
  ) {
    return this.svc.markAsRead(businessId, id);
  }

  // PATCH /businesses/:businessId/purchase-alerts/read-all
  @Patch('read-all')
  markAllAsRead(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.svc.markAllAsRead(businessId);
  }

  // PATCH /businesses/:businessId/purchase-alerts/:id/resolve
  @Patch(':id/resolve')
  resolve(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id',         ParseUUIDPipe) id:         string,
  ) {
    return this.svc.resolve(businessId, id);
  }

  // PATCH /businesses/:businessId/purchase-alerts/:id/snooze?hours=24
  @Patch(':id/snooze')
  snooze(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id',         ParseUUIDPipe) id:         string,
    @Query('hours') hours: string,
  ) {
    return this.svc.snooze(businessId, id, parseInt(hours) || 24);
  }

  // POST /businesses/:businessId/purchase-alerts/scan
  // Déclencher le scan manuellement (pour tests)
  @Post('scan')
  triggerScan(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.svc.triggerManualScan(businessId);
  }
}