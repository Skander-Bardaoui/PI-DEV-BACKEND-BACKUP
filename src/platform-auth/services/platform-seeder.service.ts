// src/platform-auth/services/platform-seeder.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { PlatformAdmin } from '../entities/platform-admin.entity';
import { Plan } from '../../platform-admin/entities/plan.entity';

@Injectable()
export class PlatformSeederService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSeederService.name);

  constructor(
    @InjectRepository(PlatformAdmin)
    private readonly adminRepo: Repository<PlatformAdmin>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const seedEnabled = this.configService.get<string>('PLATFORM_SEED_ENABLED') === 'true';

    if (!seedEnabled) {
      this.logger.log('Platform seeding is disabled (PLATFORM_SEED_ENABLED=false)');
      return;
    }

    this.logger.log('🌱 Starting platform seeding...');

    await this.seedPlatformAdmin();
    await this.seedPlans();

    this.logger.log('✅ Platform seeding completed');
  }

  private async seedPlatformAdmin() {
    try {
      const existingAdmin = await this.adminRepo.findOne({ where: {} });

      if (existingAdmin) {
        this.logger.log('Platform admin already exists, skipping...');
        return;
      }

      const email = this.configService.get<string>('PLATFORM_ADMIN_EMAIL') || 'admin@noventra.com';
      const password = this.configService.get<string>('PLATFORM_ADMIN_PASSWORD') || 'SuperSecure123!@#';

      const hashedPassword = await hash(password, 12);

      const admin = this.adminRepo.create({
        email,
        password_hash: hashedPassword,
        totp_enabled: false,
      });

      await this.adminRepo.save(admin);

      this.logger.log(`✅ Platform admin created: ${email}`);
      this.logger.warn('⚠️  IMPORTANT: Change the default password immediately!');
    } catch (error) {
      this.logger.error('Failed to seed platform admin:', error instanceof Error ? error.message : String(error));
    }
  }

  private async seedPlans() {
    try {
      const existingPlans = await this.planRepo.count();

      if (existingPlans > 0) {
        this.logger.log('Plans already exist, skipping...');
        return;
      }

      const defaultPlans: Array<{
        name: string;
        slug: string;
        price_monthly: number;
        price_annual: number;
        max_users?: number;
        max_businesses?: number;
        features: string[];
        is_active: boolean;
      }> = [
        {
          name: 'Free',
          slug: 'free',
          price_monthly: 0.0,
          price_annual: 0.0,
          max_users: 5,
          max_businesses: 1,
          features: ['Basic features', '1 business', '5 users'],
          is_active: true,
        },
        {
          name: 'Starter',
          slug: 'starter',
          price_monthly: 29.99,
          price_annual: 299.99,
          max_users: 20,
          max_businesses: 3,
          features: ['All Free features', '3 businesses', '20 users', 'Email support'],
          is_active: true,
        },
        {
          name: 'Professional',
          slug: 'professional',
          price_monthly: 99.99,
          price_annual: 999.99,
          max_users: 100,
          max_businesses: 10,
          features: [
            'All Starter features',
            '10 businesses',
            '100 users',
            'Priority support',
            'Advanced analytics',
          ],
          is_active: true,
        },
        {
          name: 'Enterprise',
          slug: 'enterprise',
          price_monthly: 299.99,
          price_annual: 2999.99,
          features: [
            'All Professional features',
            'Unlimited businesses',
            'Unlimited users',
            '24/7 support',
            'Custom integrations',
          ],
          is_active: true,
        },
      ];

      for (const planData of defaultPlans) {
        const plan = this.planRepo.create(planData);
        await this.planRepo.save(plan);
        this.logger.log(`✅ Plan created: ${planData.name}`);
      }
    } catch (error) {
      this.logger.error('Failed to seed plans:', error instanceof Error ? error.message : String(error));
    }
  }
}
