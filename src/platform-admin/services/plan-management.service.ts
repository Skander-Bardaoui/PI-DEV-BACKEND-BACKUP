// src/platform-admin/services/plan-management.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class PlanManagementService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  // ─── List All Plans ──────────────────────────────────────────────────────
  async listPlans() {
    return await this.planRepo.find({
      order: { created_at: 'ASC' },
    });
  }

  // ─── Create Plan ─────────────────────────────────────────────────────────
  async createPlan(dto: CreatePlanDto) {
    // Check if slug already exists
    const existingPlan = await this.planRepo.findOne({
      where: { slug: dto.slug },
    });

    if (existingPlan) {
      throw new BadRequestException('Plan with this slug already exists');
    }

    const plan = this.planRepo.create({
      ...dto,
      features: dto.features || [],
      is_active: dto.is_active ?? true,
    });

    return await this.planRepo.save(plan);
  }

  // ─── Update Plan ─────────────────────────────────────────────────────────
  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.planRepo.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // PLAN EDIT RESTRICTIONS:
    // Only allow updating: name, price_monthly, price_annual, is_active
    // Explicitly ignore: features, ai_enabled, trial_days, slug, max_users, max_businesses
    // These fields are plan-defining and must not be changed via API
    const allowedUpdates: Partial<Plan> = {};
    
    if (dto.name !== undefined) allowedUpdates.name = dto.name;
    if (dto.price_monthly !== undefined) allowedUpdates.price_monthly = dto.price_monthly;
    if (dto.price_annual !== undefined) allowedUpdates.price_annual = dto.price_annual;
    if (dto.is_active !== undefined) allowedUpdates.is_active = dto.is_active;

    Object.assign(plan, allowedUpdates);
    return await this.planRepo.save(plan);
  }

  // ─── Deactivate Plan ─────────────────────────────────────────────────────
  async deactivatePlan(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    plan.is_active = false;
    await this.planRepo.save(plan);

    return { message: 'Plan deactivated successfully' };
  }

  // ─── Get Plan by Slug ────────────────────────────────────────────────────
  async getPlanBySlug(slug: string) {
    const plan = await this.planRepo.findOne({
      where: { slug, is_active: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }
}