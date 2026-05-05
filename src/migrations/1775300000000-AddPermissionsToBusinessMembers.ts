import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionsToBusinessMembers1775300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add permissions column to business_members table
    await queryRunner.query(`
      ALTER TABLE business_members 
      ADD COLUMN permissions VARCHAR(6) DEFAULT '------'
    `);

    // Add check constraint for valid permission string format
    // Each position must contain valid characters: c,u,d,a,k,p or dash (-)
    await queryRunner.query(`
      ALTER TABLE business_members 
      ADD CONSTRAINT check_permissions_format 
      CHECK (
        LENGTH(permissions) = 6 AND
        permissions ~ '^[cud\-][cud\-][cud\-][ak\-][ak\-][p\-]$'
      )
    `);

    // Update existing records with role-based default permissions
    await queryRunner.query(`
      UPDATE business_members 
      SET permissions = CASE 
        WHEN role = 'BUSINESS_OWNER' THEN 'cudakp'
        WHEN role = 'BUSINESS_ADMIN' THEN 'cud---'
        WHEN role = 'TEAM_MEMBER' THEN '--u---'
        WHEN role = 'ACCOUNTANT' THEN '--u---'
        ELSE '------'
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the check constraint first
    await queryRunner.query(`
      ALTER TABLE business_members 
      DROP CONSTRAINT IF EXISTS check_permissions_format
    `);

    // Drop the permissions column
    await queryRunner.query(`
      ALTER TABLE business_members 
      DROP COLUMN permissions
    `);
  }
}