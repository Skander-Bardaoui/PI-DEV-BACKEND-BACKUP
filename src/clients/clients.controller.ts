// src/clients/clients.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientsService } from './clients.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles} from '../auth/decorators/roles.decorators';
import { Role } from '../users/enums/role.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';

@Controller('businesses/:businessId/clients')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── POST /businesses/:businessId/clients ────────────────────────────────
  @Post()
  @Roles(
    Role.PLATFORM_ADMIN,
    Role.BUSINESS_OWNER,
    Role.BUSINESS_ADMIN,
    Role.ACCOUNTANT,
    Role.TEAM_MEMBER,
  )
  async create(@Param('businessId') businessId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(businessId, dto);
  }

  // ─── GET /businesses/:businessId/clients ─────────────────────────────────
  @Get()
  async findAll(@Param('businessId') businessId: string, @Query() query: QueryClientsDto) {
    const { clients, total } = await this.clientsService.findAll(
      businessId,
      query.page,
      query.limit,
      query.search,
    );

    return {
      clients,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  // ─── GET /businesses/:businessId/clients/:id ─────────────────────────────
  @Get(':id')
  async findOne(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.clientsService.findById(businessId, id);
  }

  // ─── PATCH /businesses/:businessId/clients/:id ───────────────────────────
  @Patch(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(businessId, id, dto);
  }

  // ─── DELETE /businesses/:businessId/clients/:id ──────────────────────────
  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('businessId') businessId: string, @Param('id') id: string) {
    await this.clientsService.delete(businessId, id);
    return { message: 'Client deleted successfully' };
  }

  // ─── GET /businesses/:businessId/clients/:id/invoices ────────────────────
  // Note: This will be implemented later when we build the Invoice module
  @Get(':id/invoices')
  async getInvoices(@Param('businessId') businessId: string, @Param('id') clientId: string) {
    // TODO: Implement after Invoice module is created
    return { message: 'Invoice module not yet implemented', invoices: [] };
  }

  // ─── GET /businesses/:businessId/clients/:id/payments ────────────────────
  // Note: This will be implemented later when we build the Payment module
  @Get(':id/payments')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async getPayments(@Param('businessId') businessId: string, @Param('id') clientId: string) {
    // TODO: Implement after Payment module is created
    return { message: 'Payment module not yet implemented', payments: [] };
  }
}