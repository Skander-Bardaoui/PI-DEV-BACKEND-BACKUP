// src/platform-admin/services/plan-seed.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';

@Injectable()
export class PlanSeedService implements OnModuleInit {
  private readonly logger = new Logger(PlanSeedService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  async seedDefaultPlans() {
    this.logger.log('Seeding default plans...');

    const defaultPlans = [
      {
        name: 'Free',
        slug: 'free',
        price_monthly: 0,
        price_annual: 0,
        max_users: undefined,
        max_businesses: undefined,
        is_active: true,
        features: ['full_access', 'duration_7_days'],
        ai_enabled: false,
        trial_days: 7,
      },
      {
        name: 'Standard',
        slug: 'standard',
        price_monthly: 49.990,
        price_annual: 499.990,
        max_users: undefined,
        max_businesses: undefined,
        is_active: true,
        features: ['full_access'],
        ai_enabled: false,
        trial_days: undefined,
      },
      {
        name: 'Premium',
        slug: 'premium',
        price_monthly: 99.990,
        price_annual: 999.990,
        max_users: undefined,
        max_businesses: undefined,
        is_active: true,
        features: ['full_access', 'ai_unlimited'],
        ai_enabled: true,
        trial_days: undefined,
      },
    ];

    for (const planData of defaultPlans) {
      try {
        // Upsert based on slug
        const existingPlan = await this.planRepo.findOne({
          where: { slug: planData.slug },
        });

        if (existingPlan) {
          // Update only if needed, but preserve editable fields (name, prices)
          // Only update fixed fields: features, ai_enabled, trial_days, is_active
          existingPlan.features = planData.features;
          existingPlan.ai_enabled = planData.ai_enabled;
          existingPlan.trial_days = planData.trial_days;
          
          // If the plan was manually deactivated, respect that
          // Otherwise ensure default plans are active
          if (existingPlan.is_active === false) {
            this.logger.log(`Plan "${planData.slug}" is manually deactivated, skipping activation`);
          } else {
            existingPlan.is_active = planData.is_active;
          }

          await this.planRepo.save(existingPlan);
          this.logger.log(`Plan "${planData.slug}" updated`);
        } else {
          // Create new plan
          const newPlan = this.planRepo.create(planData);
          await this.planRepo.save(newPlan);
          this.logger.log(`Plan "${planData.slug}" created`);
        }
      } catch (error) {
        this.logger.error(`Error seeding plan "${planData.slug}":`, error);
      }
    }

    this.logger.log('Default plans seeding completed');
  }
}
