// src/businesses/businesses.controller.ts
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
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessesService } from './businesses.service';
import { BusinessMembersService } from './services/business-members.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessAccessGuard } from './guards/business-access.guard';
import { PermissionGuard } from './guards/permission.guard';
import { Role } from '../users/enums/role.enum';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { QueryBusinessesDto } from './dto/query-businesses.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { Roles } from '../auth/decorators/roles.decorators';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import {
  OwnerOnly,
  OwnerAndAdmin,
  AllBusinessMembers,
  OwnerAdminAccountant,
} from './decorators/business-access.decorator';

@Controller('businesses')
@UseGuards(AuthGuard('jwt'), RolesGuard, BusinessAccessGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly businessMembersService: BusinessMembersService,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  // ─── GET /businesses/my ──────────────────────────────────────────────────
  // Get all businesses accessible by current user
  @Get('my')
  @Roles(
    Role.BUSINESS_OWNER,
    Role.BUSINESS_ADMIN,
    Role.TEAM_MEMBER,
    Role.ACCOUNTANT,
  )
  async getMyBusinesses(@Request() req) {
    return this.businessMembersService.getUserBusinesses(req.user.id);
  }

  // ─── POST /businesses ────────────────────────────────────────────────────
  // BUSINESS_OWNER and BUSINESS_ADMIN can create businesses
  @Post()
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async create(@Body() dto: CreateBusinessDto, @Request() req) {
    let tenant: Tenant | null = null;

    // If BUSINESS_OWNER, get tenant by ownerId
    if (req.user.role === Role.BUSINESS_OWNER) {
      tenant = await this.tenantsRepository.findOne({
        where: { ownerId: req.user.id },
      });
    } else {
      // For BUSINESS_ADMIN, get tenant through business membership
      const membership = await this.businessMembersService.getUserBusinesses(req.user.id);
      if (membership.length === 0) {
        throw new BadRequestException('You are not a member of any business');
      }
      // Get the first business's tenant
      const firstBusiness = membership[0];
      tenant = await this.tenantsRepository.findOne({
        where: { id: firstBusiness.tenant_id },
      });
    }

    if (!tenant) {
      throw new BadRequestException('Tenant not found for this user');
    }

    console.log('Tenant found:', { id: tenant.id, logoUrl: tenant.logoUrl });

    // Add tenant_id and logo from tenant to the DTO
    const businessData = {
      ...dto,
      tenant_id: tenant.id,
      logo: tenant.logoUrl || dto.logo,
    };

    console.log('Business data to create:', businessData);

    const result = await this.businessesService.create(businessData);

    console.log('Created business:', result);

    // Add creator as a member of the business
    if (req.user.role === Role.BUSINESS_OWNER) {
      // BUSINESS_OWNER gets BUSINESS_OWNER role in the business
      await this.businessMembersService.addMember(
        result.id,
        req.user.id,
        Role.BUSINESS_OWNER,
        req.user.id,
      );
    } else if (req.user.role === Role.BUSINESS_ADMIN) {
      // BUSINESS_ADMIN gets BUSINESS_ADMIN role in the business
      await this.businessMembersService.addMember(
        result.id,
        req.user.id,
        Role.BUSINESS_ADMIN,
        req.user.id,
      );
    }

    return result;
  }

  // ─── GET /businesses ─────────────────────────────────────────────────────
  @Get()
  async findAll(@Query() query: QueryBusinessesDto, @Request() req) {
    const { businesses, total } = await this.businessesService.findAll(
      query.page,
      query.limit,
      query.tenant_id,
    );

    return {
      businesses,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  // ─── GET /businesses/:id ─────────────────────────────────────────────────
  // All business members can view
  @Get(':id')
  @AllBusinessMembers()
  async findOne(@Param('id') id: string) {
    return this.businessesService.findById(id);
  }

  // ─── PATCH /businesses/:id ───────────────────────────────────────────────
  // Owner and Admin can update
  @Patch(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto);
  }

  // ─── DELETE /businesses/:id ──────────────────────────────────────────────
  // Only Owner can delete
  @Delete(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER)
  @OwnerOnly()
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.businessesService.delete(id);
    return { message: 'Business deleted successfully' };
  }

  // ─── GET /businesses/:id/settings ────────────────────────────────────────
  @Get(':id/settings')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @OwnerAdminAccountant()
  async getSettings(@Param('id') id: string) {
    return this.businessesService.getSettings(id);
  }

  // ─── PATCH /businesses/:id/settings ──────────────────────────────────────
  @Patch(':id/settings')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessSettingsDto,
  ) {
    return this.businessesService.updateSettings(id, dto);
  }

  // ─── Tax Rates Management ────────────────────────────────────────────────

  // POST /businesses/:id/tax-rates
  @Post(':id/tax-rates')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async createTaxRate(
    @Param('id') business_id: string,
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.businessesService.createTaxRate(business_id, dto);
  }

  // GET /businesses/:id/tax-rates
  @Get(':id/tax-rates')
  @OwnerAdminAccountant()
  async getTaxRates(@Param('id') business_id: string) {
    return this.businessesService.getTaxRates(business_id);
  }

  // PATCH /businesses/:id/tax-rates/:taxId
  @Patch(':id/tax-rates/:taxId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async updateTaxRate(
    @Param('id') business_id: string,
    @Param('taxId') taxRateId: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.businessesService.updateTaxRate(business_id, taxRateId, dto);
  }

  // DELETE /businesses/:id/tax-rates/:taxId
  @Delete(':id/tax-rates/:taxId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  @HttpCode(HttpStatus.OK)
  async deleteTaxRate(
    @Param('id') business_id: string,
    @Param('taxId') taxRateId: string,
  ) {
    await this.businessesService.deleteTaxRate(business_id, taxRateId);
    return { message: 'Tax rate deleted successfully' };
  }

  // ─── Business Members Management ─────────────────────────────────────────

  // GET /businesses/:id/members
  //@Get(':id/members')
 // @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
 // @OwnerAndAdmin()
 // async getMembers(@Param('id') businessId: string) {
  //  return this.businessMembersService.getBusinessMembers(businessId);
  //}
  
  // GET /businesses/:id/members
@Get(':id/members')
@AllBusinessMembers()   // ← tous les membres peuvent voir
async getMembers(@Param('id') businessId: string) {
  return this.businessMembersService.getBusinessMembers(businessId);
}

  // POST /businesses/:id/members
  @Post(':id/members')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async addMember(
    @Param('id') businessId: string,
    @Body() body: { userId: string; role: Role },
    @Request() req,
  ) {
    return this.businessMembersService.addMember(
      businessId,
      body.userId,
      body.role,
      req.user.id,
    );
  }

  // DELETE /businesses/:id/members/:userId
  @Delete(':id/members/:userId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @Param('id') businessId: string,
    @Param('userId') userId: string,
  ) {
    await this.businessMembersService.removeMember(businessId, userId);
    return { message: 'Member removed successfully' };
  }

  // PATCH /businesses/:id/members/:userId/role
  @Patch(':id/members/:userId/role')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async updateMemberRole(
    @Param('id') businessId: string,
    @Param('userId') userId: string,
    @Body() body: { role: Role },
  ) {
    console.log('Update member role request:', { businessId, userId, role: body.role });
    const result = await this.businessMembersService.updateMemberRole(
      businessId,
      userId,
      body.role,
    );
    console.log('Update member role result:', result);
    return result;
  }

  // PATCH /businesses/:id/members/:userId/permissions
  @Patch(':id/members/:userId/permissions')
  @UseGuards(AuthGuard('jwt'), RolesGuard, BusinessAccessGuard, PermissionGuard)
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async updateMemberPermissions(
    @Param('id') businessId: string,
    @Param('userId') userId: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
    @Request() req,
  ) {
    // Prevent self-modification
    if (req.user.id === userId) {
      throw new BadRequestException('Cannot modify your own permissions');
    }

    // Get current user's role
    const currentUserRole = req.user.role;

    // Get target member to check their role
    const targetMember = await this.businessMembersService.getBusinessMemberDetails(
      businessId,
      userId,
    );

    if (!targetMember) {
      throw new NotFoundException('Target member not found');
    }

    // Apply role-based restrictions
    if (currentUserRole === Role.BUSINESS_ADMIN) {
      // BUSINESS_ADMIN can only update TEAM_MEMBER and ACCOUNTANT
      if (targetMember.role === Role.BUSINESS_OWNER) {
        throw new ForbiddenException(
          'BUSINESS_ADMIN cannot update BUSINESS_OWNER permissions',
        );
      }
      if (targetMember.role === Role.BUSINESS_ADMIN) {
        throw new ForbiddenException(
          'BUSINESS_ADMIN cannot update another BUSINESS_ADMIN permissions',
        );
      }
      if (targetMember.role !== Role.TEAM_MEMBER && targetMember.role !== Role.ACCOUNTANT) {
        throw new ForbiddenException(
          'BUSINESS_ADMIN can only update TEAM_MEMBER and ACCOUNTANT permissions',
        );
      }
    }

    return this.businessMembersService.updateMemberPermissions(
      businessId,
      userId,
      updatePermissionsDto.collaboration_permissions,
      updatePermissionsDto.stock_permissions,
      updatePermissionsDto.payment_permissions,
      updatePermissionsDto.salary_permissions,
      updatePermissionsDto.sales_permissions,
      updatePermissionsDto.purchase_permissions,
    );
  }

  // POST /businesses/seed-permissions - Admin endpoint to seed existing members
  @Post('seed-permissions')
  @Roles(Role.PLATFORM_ADMIN)
  async seedMemberPermissions() {
    return this.businessMembersService.seedExistingMembersWithDefaultPermissions();
  }
}