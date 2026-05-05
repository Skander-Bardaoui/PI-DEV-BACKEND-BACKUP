import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringInvoiceEnhancements1775300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ajouter la colonne status
    await queryRunner.query(`
      ALTER TABLE recurring_invoices 
      ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'
    `);

    // 2. Migrer les données existantes
    await queryRunner.query(`
      UPDATE recurring_invoices 
      SET status = CASE 
        WHEN is_active = true THEN 'ACTIVE' 
        ELSE 'INACTIVE' 
      END
    `);

    // 3. Ajouter les colonnes pour les remises
    await queryRunner.query(`
      ALTER TABLE recurring_invoices
      ADD COLUMN discount_type VARCHAR(20) DEFAULT NULL,
      ADD COLUMN discount_value DECIMAL(10,3) DEFAULT NULL
    `);

    // 4. Ajouter la FK recurring_invoice_id sur invoices
    await queryRunner.query(`
      ALTER TABLE invoices
      ADD COLUMN recurring_invoice_id UUID DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_recurring_invoice
      FOREIGN KEY (recurring_invoice_id) 
      REFERENCES recurring_invoices(id)
      ON DELETE SET NULL
    `);

    // 5. Créer un index pour améliorer les performances
    await queryRunner.query(`
      CREATE INDEX idx_recurring_invoices_status_next_date 
      ON recurring_invoices(status, next_invoice_date)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoices_recurring_invoice_id 
      ON invoices(recurring_invoice_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_recurring_invoice_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_recurring_invoices_status_next_date`);
    
    await queryRunner.query(`
      ALTER TABLE invoices 
      DROP CONSTRAINT IF EXISTS fk_invoices_recurring_invoice
    `);
    
    await queryRunner.query(`ALTER TABLE invoices DROP COLUMN IF EXISTS recurring_invoice_id`);
    await queryRunner.query(`ALTER TABLE recurring_invoices DROP COLUMN IF EXISTS discount_value`);
    await queryRunner.query(`ALTER TABLE recurring_invoices DROP COLUMN IF EXISTS discount_type`);
    await queryRunner.query(`ALTER TABLE recurring_invoices DROP COLUMN IF EXISTS status`);
  }
}
