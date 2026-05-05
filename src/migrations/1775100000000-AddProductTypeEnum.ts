import { MigrationInterface, QueryRunner } from 'typeorm';

// ==================== Alaa change for service type ====================
export class AddProductTypeEnum1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the default value from 'product' to 'PHYSICAL'
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN type SET DEFAULT 'PHYSICAL'
    `);

    // Update existing rows where type = 'product' to type = 'PHYSICAL'
    await queryRunner.query(`
      UPDATE products 
      SET type = 'PHYSICAL' 
      WHERE type = 'product'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert PHYSICAL back to 'product'
    await queryRunner.query(`
      UPDATE products 
      SET type = 'product' 
      WHERE type = 'PHYSICAL'
    `);

    // Revert the default value
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN type SET DEFAULT 'product'
    `);
  }
}
// ====================================================================
