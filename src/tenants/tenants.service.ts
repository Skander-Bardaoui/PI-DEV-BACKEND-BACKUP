// src/tenants/tenants.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './entities/dto/create-tenant.dto';
import { UpdateTenantDto } from './entities/dto/update-tenant.dto';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Business } from '../businesses/entities/business.entity';
import { Role } from '../users/enums/role.enum';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';


@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(BusinessMember)
    private readonly businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  // ─── Create Tenant ───────────────────────────────────────────────────────
  async create(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepository.create(dto);
    return this.tenantRepository.save(tenant);
  }

  // ─── List All Tenants (with pagination) ─────────────────────────────────
  async findAll(page: number = 1, limit: number = 20): Promise<{ tenants: Tenant[]; total: number }> {
    const skip = (page - 1) * limit;

    const [tenants, total] = await this.tenantRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { tenants, total };
  }

  // ─── Get Tenant by ID ────────────────────────────────────────────────────
  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  // ─── Get Tenant by Owner ID ──────────────────────────────────────────────
  async findByOwnerId(ownerId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { ownerId } });
    if (!tenant) {
      throw new NotFoundException('You do not own any tenant');
    }
    return tenant;
  }

  // ─── Get My Tenant (works for all roles) ─────────────────────────────────
  async findMyTenant(userId: string, userRole: Role): Promise<Tenant> {
    // If BUSINESS_OWNER, get by ownerId
    if (userRole === Role.BUSINESS_OWNER) {
      return this.findByOwnerId(userId);
    }

    // For other roles, get tenant through business membership
    const membership = await this.businessMemberRepository.findOne({
      where: { user_id: userId, is_active: true },
      relations: ['business'],
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of any business');
    }

    const business = await this.businessRepository.findOne({
      where: { id: membership.business_id },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: business.tenant_id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  // ─── Update Tenant ───────────────────────────────────────────────────────
  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.tenantRepository.update(id, dto);
    
    // If logo is being updated, sync to all businesses
    if (dto.logoUrl) {
      await this.businessRepository.update(
        { tenant_id: id },
        { logo: dto.logoUrl }
      );
    }
    
    return this.findById(id);
  }

  // ─── Upload Tenant Logo ──────────────────────────────────────────────────
  async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<string> {
    const tenant = await this.findById(tenantId);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const filename = `${tenantId}-${Date.now()}.webp`;
    const filepath = path.join(uploadsDir, filename);

    // Process and compress image using sharp
    const sharp = (await import('sharp')).default;
    await sharp(file.buffer)
      .resize(200, 200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({ quality: 90 })
      .toFile(filepath);

    // Delete old logo if exists
    if (tenant.logoUrl) {
      const oldFilepath = path.join(process.cwd(), 'public', tenant.logoUrl);
      try {
        await fs.unlink(oldFilepath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }

    // Update tenant logo URL
    const logoUrl = `/uploads/logos/${filename}`;
    await this.tenantRepository.update(tenantId, { logoUrl });

    // Sync logo to all businesses under this tenant
    await this.businessRepository.update(
      { tenant_id: tenantId },
      { logo: logoUrl }
    );

    return logoUrl;
  }

  // ─── Delete Tenant ───────────────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    const result = await this.tenantRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Tenant not found');
    }
  }

  // ─── Check if user owns this tenant ──────────────────────────────────────
  async checkOwnership(tenantId: string, userId: string): Promise<boolean> {
    const tenant = await this.findById(tenantId);
    return tenant.ownerId === userId;
  }
}