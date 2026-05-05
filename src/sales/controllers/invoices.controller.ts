import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService } from '../services/invoices.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { SalesPermissionGuard } from '../guards/sales-permission.guard';
import { RequireSalesPermission } from '../decorators/sales-permission.decorator';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

@Controller('businesses/:businessId/invoices')
@UseGuards(AuthGuard('jwt'), RolesGuard, SalesPermissionGuard)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('create_invoice')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(businessId, dto);
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: any,
  ) {
    return this.service.findAll(businessId, query);
  }

  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_invoice')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Post(':id/send')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('send_invoice')
  send(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.send(businessId, id);
  }

  @Post(':id/send-email')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('send_invoice')
  async sendByEmail(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { email?: string; subject?: string; body?: string },
  ) {
    return this.service.sendByEmail(businessId, id, body.email, body.subject, body.body);
  }

  @Post(':id/generate-email-draft')
  @UseGuards(AiFeatureGuard)
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async generateEmailDraft(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { language?: 'fr' | 'ar'; isReminder?: boolean },
  ) {
    return this.service.generateEmailDraft(
      businessId,
      id,
      body.language || 'fr',
      body.isReminder || false,
    );
  }

  @Post(':id/send-reminder')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('send_invoice')
  async sendPaymentReminder(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { email?: string },
  ) {
    await this.service.sendPaymentReminder(businessId, id, body.email);
    return {
      success: true,
      message: 'Rappel de paiement envoyé avec succès',
    };
  }

  @Post(':id/mark-partially-paid')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_invoice')
  markPartiallyPaid(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markPartiallyPaid(businessId, id);
  }

  @Post(':id/mark-paid')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_invoice')
  markPaid(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markPaid(businessId, id);
  }

  @Post(':id/mark-overdue')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_invoice')
  markOverdue(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markOverdue(businessId, id);
  }

  @Post(':id/cancel')
  @Roles(Role.BUSINESS_OWNER)
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(businessId, id);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @RequireSalesPermission('delete_invoice')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(businessId, id);
  }
}
