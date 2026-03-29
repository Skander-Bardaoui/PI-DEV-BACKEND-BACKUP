// src/businesses/businesses.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { BusinessSettings } from './entities/business-settings.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { TaxRate } from './entities/tax-rate.entity';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { Tenant } from '../tenants/entities/tenant.entity';


@Injectable()
export class BusinessesService {
 constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(BusinessSettings)
    private readonly settingsRepository: Repository<BusinessSettings>,
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  // ─── Get My Businesses (by user ID) ──────────────────────────────────────
  async getMyBusinesses(userId: string): Promise<Business[]> {
    // Find tenant owned by this user
    const tenant = await this.tenantRepository.findOne({
      where: { ownerId: userId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found for this user');
    }

    // Get all businesses for this tenant
    return this.businessRepository.find({
      where: { tenant_id: tenant.id },
      order: { created_at: 'DESC' },
    });
  }

  // ─── Create Business ─────────────────────────────────────────────────────
  async create(dto: CreateBusinessDto): Promise<Business> {
    console.log('Service received DTO:', dto);
    
    // Default currency to TND if not provided
    const business = this.businessRepository.create({
      ...dto,
      currency: dto.currency || 'TND',
    });

    console.log('Business entity before save:', business);

    const saved = await this.businessRepository.save(business);

    console.log('Business entity after save:', saved);

    // Create default settings for this business
    await this.settingsRepository.save({
      business_id: saved.id,
      invoice_prefix: 'INV-',
      payment_terms: 30,
    });

    return saved;
  }

  // ─── List Businesses (filtered by tenant if provided) ───────────────────
  async findAll(
    page: number = 1,
    limit: number = 20,
    tenant_id?: string,
  ): Promise<{ businesses: Business[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = tenant_id ? { tenant_id } : {};

    const [businesses, total] = await this.businessRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { businesses, total };
  }

  // ─── Get Business by ID ──────────────────────────────────────────────────
  async findById(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  // ─── Update Business ─────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBusinessDto): Promise<Business> {
    await this.businessRepository.update(id, dto);
    return this.findById(id);
  }

  // ─── Delete Business ─────────────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    const result = await this.businessRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Business not found');
    }
  }

  // ─── Get Business Settings ───────────────────────────────────────────────
  async getSettings(business_id: string): Promise<BusinessSettings> {
    const settings = await this.settingsRepository.findOne({
      where: { business_id },
    });

    if (!settings) {
      throw new NotFoundException('Business settings not found');
    }

    return settings;
  }

  // ─── Update Business Settings ────────────────────────────────────────────
  async updateSettings(
    business_id: string,
    dto: UpdateBusinessSettingsDto,
  ): Promise<BusinessSettings> {
    const settings = await this.getSettings(business_id);
    await this.settingsRepository.update(settings.id, dto);
    return this.getSettings(business_id);
  }

  // ─── Check if user has access to this business ──────────────────────────
  async checkAccess(businessId: string, userId: string, tenantOwnerId: string): Promise<boolean> {
    const business = await this.findById(businessId);
    // User has access if they own the tenant this business belongs to
    return business.tenant_id === tenantOwnerId;
  }

  // ─── Tax Rates Management ────────────────────────────────────────────────

  // Create Tax Rate
async createTaxRate(business_id: string, dto: CreateTaxRateDto): Promise<TaxRate> {
    // If is_default is true, unset any existing default for this business
    if (dto.is_default) {
      await this.taxRateRepository
        .createQueryBuilder()
        .update(TaxRate)
        .set({ is_default: false })
        .where('business_id = :business_id AND is_default = :is_default', {
          business_id,
          is_default: true,
        })
        .execute();
    }

    const taxRate = this.taxRateRepository.create({
      business_id,
      ...dto,
    });

    return this.taxRateRepository.save(taxRate);
  }

  // List Tax Rates for a Business
  async getTaxRates(business_id: string): Promise<TaxRate[]> {
    return this.taxRateRepository.find({
      where: { business_id },
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  // Get Single Tax Rate
  async getTaxRateById(business_id: string, taxRateId: string): Promise<TaxRate> {
    const taxRate = await this.taxRateRepository.findOne({
      where: { id: taxRateId, business_id },
    });

    if (!taxRate) {
      throw new NotFoundException('Tax rate not found');
    }

    return taxRate;
  }

async updateTaxRate(
    business_id: string,
    taxRateId: string,
    dto: UpdateTaxRateDto,
  ): Promise<TaxRate> {
    // If setting this as default, unset any existing default
    if (dto.is_default) {
      await this.taxRateRepository
        .createQueryBuilder()
        .update(TaxRate)
        .set({ is_default: false })
        .where('business_id = :business_id AND is_default = :is_default', {
          business_id,
          is_default: true,
        })
        .execute();
    }

    await this.taxRateRepository.update(taxRateId, dto);
    return this.getTaxRateById(business_id, taxRateId);
  }

  // Delete Tax Rate
  async deleteTaxRate(business_id: string, taxRateId: string): Promise<void> {
    const result = await this.taxRateRepository.delete({ id: taxRateId, business_id });
    if (result.affected === 0) {
      throw new NotFoundException('Tax rate not found');
    }
  }
}