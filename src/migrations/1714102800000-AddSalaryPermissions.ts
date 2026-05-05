import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalaryPermissions1714102800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add salary_permissions column to business_members table
    await queryRunner.query(`
      ALTER TABLE business_members 
      ADD COLUMN IF NOT EXISTS salary_permissions jsonb DEFAULT '{}'::jsonb
    `);

    // Set default permissions for BUSINESS_OWNER (all permissions enabled)
    await queryRunner.query(`
      UPDATE business_members 
      SET salary_permissions = '{
        "create_salary": true,
        "update_salary": true,
        "delete_salary": true,
        "send_proposal": true,
        "pay_salary": true
      }'::jsonb
      WHERE role = 'BUSINESS_OWNER'
    `);

    // Set default permissions for other roles (all permissions disabled)
    await queryRunner.query(`
      UPDATE business_members 
      SET salary_permissions = '{
        "create_salary": false,
        "update_salary": false,
        "delete_salary": false,
        "send_proposal": false,
        "pay_salary": false
      }'::jsonb
      WHERE role != 'BUSINESS_OWNER'
    `);

    console.log('✅ Added salary_permissions column to business_members table');
    console.log('✅ Set default permissions for existing members');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove salary_permissions column
    await queryRunner.query(`
      ALTER TABLE business_members 
      DROP COLUMN IF EXISTS salary_permissions
    `);

    console.log('✅ Removed salary_permissions column from business_members table');
  }
}
