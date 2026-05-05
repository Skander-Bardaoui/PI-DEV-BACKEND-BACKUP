// src/platform-admin/controllers/public-plans.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';

@Controller('api/plans')
export class PublicPlansController {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  // ─── Get Public Plans (No Auth Required) ────────────────────────────────
  @Get('public')
  async getPublicPlans() {
    const plans = await this.planRepo.find({
      where: { is_active: true },
      order: { price_monthly: 'ASC' },
    });

    return plans;
  }
}
