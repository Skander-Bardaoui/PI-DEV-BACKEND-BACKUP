import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSubscriptionPaymentsTable1775500000000 implements MigrationInterface {
  name = 'CreateSubscriptionPaymentsTable1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create subscription_payments table
    await queryRunner.createTable(
      new Table({
        name: 'subscription_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'subscription_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'invoice_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'TND'",
            isNullable: false,
          },
          {
            name: 'method',
            type: 'enum',
            enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'],
            isNullable: false,
          },
          {
            name: 'reference_number',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'stripe_payment_intent_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'payer_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'payer_phone',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'],
            default: "'PENDING_VERIFICATION'",
            isNullable: false,
          },
          {
            name: 'submitted_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['subscription_id'],
            referencedTableName: 'subscriptions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          new TableIndex({ name: 'IDX_subscription_payments_subscription_id', columnNames: ['subscription_id'] }),
          new TableIndex({ name: 'IDX_subscription_payments_business_id', columnNames: ['business_id'] }),
          new TableIndex({ name: 'IDX_subscription_payments_status', columnNames: ['status'] }),
          new TableIndex({ name: 'IDX_subscription_payments_submitted_at', columnNames: ['submitted_at'] }),
        ],
      }),
      true,
    );

    console.log('✅ Created subscription_payments table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscription_payments');
    console.log('✅ Dropped subscription_payments table');
  }
}