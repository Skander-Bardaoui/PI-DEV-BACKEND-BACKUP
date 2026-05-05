import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringSubscriptionTokens1775400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recurring_subscription_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        token VARCHAR(255) UNIQUE NOT NULL,
        recurring_invoice_id UUID NOT NULL,
        invoice_id UUID NOT NULL,
        business_id UUID NOT NULL,
        client_id UUID NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        action VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_recurring_subscription_recurring
          FOREIGN KEY (recurring_invoice_id)
          REFERENCES recurring_invoices(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_recurring_subscription_invoice
          FOREIGN KEY (invoice_id)
          REFERENCES invoices(id)
          ON DELETE CASCADE
      );

      CREATE INDEX idx_recurring_subscription_token ON recurring_subscription_tokens(token);
      CREATE INDEX idx_recurring_subscription_recurring ON recurring_subscription_tokens(recurring_invoice_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recurring_subscription_tokens;`);
  }
}
