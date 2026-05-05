// src/migrations/1775600000000-AddPlansAndPayments.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlansAndPayments1775600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create plans table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        price_monthly DECIMAL(10,2) NOT NULL,
        price_annual DECIMAL(10,2) NOT NULL,
        max_users INTEGER,
        max_businesses INTEGER,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create index on slug for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
    `);

    // Create index on is_active for filtering active plans
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
    `);

    // Add payment_token column to subscriptions table if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE subscriptions 
      ADD COLUMN IF NOT EXISTS payment_token UUID UNIQUE;
    `);

    // Generate payment tokens for existing subscriptions
    await queryRunner.query(`
      UPDATE subscriptions 
      SET payment_token = uuid_generate_v4() 
      WHERE payment_token IS NULL;
    `);

    // Update subscription_status enum to include new statuses
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_new') THEN
          CREATE TYPE subscription_status_new AS ENUM (
            'pending_payment',
            'payment_submitted',
            'trial',
            'active',
            'overdue',
            'suspended',
            'cancelled'
          );
          
          ALTER TABLE subscriptions 
          ALTER COLUMN status TYPE subscription_status_new 
          USING status::text::subscription_status_new;
          
          DROP TYPE IF EXISTS subscription_status;
          
          ALTER TYPE subscription_status_new RENAME TO subscription_status;
        END IF;
      END $$;
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'TND',
        method VARCHAR(50) NOT NULL,
        reference_number VARCHAR(255),
        payer_name VARCHAR(255) NOT NULL,
        payer_phone VARCHAR(50) NOT NULL,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
        submitted_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes on payments table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_submitted_at ON payments(submitted_at DESC);
    `);

    // Insert default plans
    await queryRunner.query(`
      INSERT INTO plans (name, slug, price_monthly, price_annual, max_users, max_businesses, features, is_active)
      VALUES 
        (
          'Starter',
          'starter',
          49.000,
          490.000,
          5,
          1,
          '["Gestion des factures", "Gestion des clients", "Tableau de bord basique", "Support par email", "1 utilisateur"]'::jsonb,
          true
        ),
        (
          'Professional',
          'professional',
          99.000,
          990.000,
          15,
          3,
          '["Toutes les fonctionnalités Starter", "Gestion multi-entreprises", "Rapports avancés", "Gestion des stocks", "Intégrations API", "Support prioritaire", "Jusqu''à 15 utilisateurs"]'::jsonb,
          true
        ),
        (
          'Enterprise',
          'enterprise',
          199.000,
          1990.000,
          NULL,
          NULL,
          '["Toutes les fonctionnalités Professional", "Utilisateurs illimités", "Entreprises illimitées", "Prédictions IA", "Support dédié 24/7", "Formation personnalisée", "SLA garanti"]'::jsonb,
          true
        ),
        (
          'Free',
          'free',
          0.000,
          0.000,
          1,
          1,
          '["Fonctionnalités de base", "1 utilisateur", "1 entreprise", "Support communautaire"]'::jsonb,
          true
        )
      ON CONFLICT (slug) DO NOTHING;
    `);

    console.log('✅ Plans and Payments tables created successfully');
    console.log('✅ Default plans inserted');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop payments table
    await queryRunner.query(`DROP TABLE IF EXISTS payments CASCADE;`);

    // Remove payment_token column from subscriptions
    await queryRunner.query(`
      ALTER TABLE subscriptions 
      DROP COLUMN IF EXISTS payment_token;
    `);

    // Drop plans table
    await queryRunner.query(`DROP TABLE IF EXISTS plans CASCADE;`);

    // Note: We don't revert the enum changes as it might break existing data
    console.log('⚠️  Note: subscription_status enum changes were not reverted to prevent data loss');
  }
}
