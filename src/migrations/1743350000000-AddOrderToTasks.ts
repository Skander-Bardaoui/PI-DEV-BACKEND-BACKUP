import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderToTasks1743350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add order column with default value 0
    await queryRunner.query(`
      ALTER TABLE tasks ADD COLUMN "order" integer DEFAULT 0;
    `);

    // Initialize order based on creation date within each status group
    await queryRunner.query(`
      WITH ranked AS (
        SELECT 
          id, 
          status,
          ROW_NUMBER() OVER (PARTITION BY status ORDER BY "createdAt" ASC) - 1 AS new_order
        FROM tasks
      )
      UPDATE tasks
      SET "order" = ranked.new_order
      FROM ranked
      WHERE tasks.id = ranked.id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks DROP COLUMN "order";
    `);
  }
}
