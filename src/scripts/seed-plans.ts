// src/scripts/seed-plans.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PlanManagementService } from '../platform-admin/services/plan-management.service';

async function seedPlans() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const planService = app.get(PlanManagementService);

  try {
    console.log('🌱 Seeding default plans...');

    // Free Plan
    const freePlan = {
      name: 'Free',
      slug: 'free',
      price_monthly: 0,
      price_annual: 0,
      max_users: 3,
      max_businesses: 1,
      features: [
        'basic_invoicing',
        'client_management',
        'basic_reports',
        'email_support',
      ],
      is_active: true,
    };

    // Premium Plan
    const premiumPlan = {
      name: 'Premium',
      slug: 'premium',
      price_monthly: 29.99,
      price_annual: 299.99,
      max_users: 10,
      max_businesses: 3,
      features: [
        'advanced_invoicing',
        'client_management',
        'inventory_management',
        'advanced_reports',
        'team_collaboration',
        'priority_support',
        'custom_branding',
      ],
      is_active: true,
    };

    // Enterprise Plan
    const enterprisePlan = {
      name: 'Enterprise',
      slug: 'enterprise',
      price_monthly: 99.99,
      price_annual: 999.99,
      max_users: undefined, // Unlimited
      max_businesses: undefined, // Unlimited
      features: [
        'advanced_invoicing',
        'client_management',
        'inventory_management',
        'advanced_reports',
        'team_collaboration',
        'priority_support',
        'custom_branding',
        'api_access',
        'white_label',
        'dedicated_support',
        'custom_integrations',
      ],
      is_active: true,
    };

    // Create plans
    await planService.createPlan(freePlan);
    console.log('✅ Created Free plan');

    await planService.createPlan(premiumPlan);
    console.log('✅ Created Premium plan');

    await planService.createPlan(enterprisePlan);
    console.log('✅ Created Enterprise plan');

    console.log('🎉 Plans seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
  } finally {
    await app.close();
  }
}

seedPlans();