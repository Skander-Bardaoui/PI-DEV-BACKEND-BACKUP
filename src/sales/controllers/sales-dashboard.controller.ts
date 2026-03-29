import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { SalesDashboardService } from '../services/sales-dashboard.service';
import { SalesDashboardAiService } from '../services/sales-dashboard-ai.service';
import { SalesEmailAiService } from '../services/sales-email-ai.service';

@Controller('businesses/:businessId/sales/dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SalesDashboardController {
  constructor(
    private readonly service: SalesDashboardService,
    private readonly dashboardAiService: SalesDashboardAiService,
    private readonly emailAiService: SalesEmailAiService,
  ) {}

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  getDashboardStats(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.service.getDashboardStats(businessId);
  }

  @Get('ai-forecast')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async getAiForecast(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.dashboardAiService.generateForecast(businessId);
  }

  @Post('generate-email-draft')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async generateEmailDraft(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() params: {
      clientName: string;
      invoiceNumber: string;
      amount: number;
      dueDate: string;
      isReminder: boolean;
      language?: 'fr' | 'ar';
    },
  ) {
    return this.emailAiService.generateEmailDraft(params);
  }
}
