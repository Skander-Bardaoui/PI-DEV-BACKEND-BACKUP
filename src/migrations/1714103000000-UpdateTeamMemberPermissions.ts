import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTeamMemberPermissions1714103000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update existing TEAM_MEMBER records to have update_task, update_product, and update_service enabled
    await queryRunner.query(`
      UPDATE business_members 
      SET 
        collaboration_permissions = collaboration_permissions || '{"update_task": true}'::jsonb,
        stock_permissions = stock_permissions || '{"update_product": true, "update_service": true}'::jsonb
      WHERE role = 'TEAM_MEMBER'
    `);

    console.log('✅ Updated TEAM_MEMBER permissions: update_task, update_product, update_service now enabled');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: set these permissions back to false for TEAM_MEMBER
    await queryRunner.query(`
      UPDATE business_members 
      SET 
        collaboration_permissions = collaboration_permissions || '{"update_task": false}'::jsonb,
        stock_permissions = stock_permissions || '{"update_product": false, "update_service": false}'::jsonb
      WHERE role = 'TEAM_MEMBER'
    `);

    console.log('✅ Rolled back TEAM_MEMBER permissions');
  }
}
