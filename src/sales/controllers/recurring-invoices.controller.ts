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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecurringInvoicesService } from '../services/recurring-invoices.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { CreateRecurringInvoiceDto } from '../dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from '../dto/update-recurring-invoice.dto';
import { QueryRecurringInvoicesDto } from '../dto/query-recurring-invoices.dto';
import { BulkUpdateRecurringInvoicesDto } from '../dto/bulk-update-recurring-invoices.dto';
import { SalesPermissionGuard } from '../guards/sales-permission.guard';
import { RequireSalesPermission } from '../decorators/sales-permission.decorator';

@Controller('businesses/:businessId/recurring-invoices')
@UseGuards(AuthGuard('jwt'), RolesGuard, SalesPermissionGuard)
export class RecurringInvoicesController {
  constructor(private readonly service: RecurringInvoicesService) {}

  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('create_recurring')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateRecurringInvoiceDto,
  ) {
    return this.service.create(businessId, dto);
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: QueryRecurringInvoicesDto,
  ) {
    return this.service.findAll(businessId, query);
  }

  @Get('stats')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  getStats(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.service.getStats(businessId);
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
  @RequireSalesPermission('update_recurring')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringInvoiceDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @RequireSalesPermission('delete_recurring')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(businessId, id);
  }

  @Post(':id/activate')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_recurring')
  activate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activate(businessId, id);
  }

  @Post(':id/deactivate')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_recurring')
  deactivate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deactivate(businessId, id);
  }

  @Post(':id/pause')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_recurring')
  pause(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.pause(businessId, id);
  }

  @Post(':id/resume')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_recurring')
  resume(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.resume(businessId, id);
  }

  @Patch('bulk')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @RequireSalesPermission('update_recurring')
  bulkUpdate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: BulkUpdateRecurringInvoicesDto,
  ) {
    return this.service.bulkUpdate(businessId, dto);
  }

  @Get(':id/invoices')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  getInvoiceHistory(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getInvoiceHistory(businessId, id, page, limit);
  }

  @Post(':id/generate-test')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  generateTestInvoice(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.generateTestInvoice(businessId, id);
  }
}
