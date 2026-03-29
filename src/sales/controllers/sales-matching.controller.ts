// src/sales/controllers/sales-matching.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../../businesses/guards/business-access.guard';
import { SalesMatchingService } from '../services/sales-matching.service';

@Controller('businesses/:businessId/sales-matching')
@UseGuards(JwtAuthGuard, BusinessAccessGuard)
export class SalesMatchingController {
  constructor(private readonly matchingService: SalesMatchingService) {}

  @Get('invoice/:invoiceId')
  async matchInvoice(
    @Param('businessId') businessId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.matchingService.matchInvoice(businessId, invoiceId);
  }

  @Get('draft')
  async getDraftMatches(@Param('businessId') businessId: string) {
    return this.matchingService.getDraftMatches(businessId);
  }
}
