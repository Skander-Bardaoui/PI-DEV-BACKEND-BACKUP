// src/migrations/1775500000000-AddPlatformAnalyticsAndSupport.ts
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddPlatformAnalyticsAndSupport1775500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create platform_audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'platform_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'admin_id',
            type: 'uuid',
          },
          {
            name: 'action',
            type: 'varchar',
          },
          {
            name: 'target_type',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'target_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key for admin_id
    await queryRunner.createForeignKey(
      'platform_audit_logs',
      new TableForeignKey({
        columnNames: ['admin_id'],
        referencedTableName: 'platform_admins',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create support_tickets table
    await queryRunner.createTable(
      new Table({
        name: 'support_tickets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
          },
          {
            name: 'submitted_by_id',
            type: 'uuid',
          },
          {
            name: 'subject',
            type: 'varchar',
          },
          {
            name: 'body',
            type: 'text',
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high'],
            default: "'medium'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            default: "'open'",
          },
          {
            name: 'assigned_to_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resolved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign keys for support_tickets
    await queryRunner.createForeignKey(
      'support_tickets',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'support_tickets',
      new TableForeignKey({
        columnNames: ['submitted_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'support_tickets',
      new TableForeignKey({
        columnNames: ['assigned_to_id'],
        referencedTableName: 'platform_admins',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_admin_id ON platform_audit_logs(admin_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_action ON platform_audit_logs(action)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_target_type ON platform_audit_logs(target_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_created_at ON platform_audit_logs(created_at)`,
    );

    await queryRunner.query(
      `CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_support_tickets_status ON support_tickets(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_support_tickets_assigned_to_id ON support_tickets(assigned_to_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_support_tickets_assigned_to_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_support_tickets_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_support_tickets_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_target_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_action`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_admin_id`);

    // Drop tables
    await queryRunner.dropTable('support_tickets');
    await queryRunner.dropTable('platform_audit_logs');
  }
}
