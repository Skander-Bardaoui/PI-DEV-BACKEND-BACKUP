import { MigrationInterface, QueryRunner } from 'typeorm';

// ==================== Alaa change for service type ====================
export class AddCategoryType1775200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add category_type column with default value 'PRODUCT'
    await queryRunner.query(`
      ALTER TABLE product_categories 
      ADD COLUMN category_type VARCHAR(20) DEFAULT 'PRODUCT'
    `);

    // Update all existing rows to have category_type = 'PRODUCT'
    await queryRunner.query(`
      UPDATE product_categories 
      SET category_type = 'PRODUCT' 
      WHERE category_type IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the category_type column
    await queryRunner.query(`
      ALTER TABLE product_categories 
      DROP COLUMN category_type
    `);
  }
}
// ====================================================================
