import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThreadingToMessages1743360000000 implements MigrationInterface {
  name = 'AddThreadingToMessages1743360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add parentMessageId column
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD COLUMN "parentMessageId" uuid NULL
    `);

    // Add replyCount column
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD COLUMN "replyCount" integer NOT NULL DEFAULT 0
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD CONSTRAINT "FK_messages_parentMessageId" 
      FOREIGN KEY ("parentMessageId") 
      REFERENCES "messages"("id") 
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "messages" 
      DROP CONSTRAINT "FK_messages_parentMessageId"
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "messages" 
      DROP COLUMN "replyCount"
    `);

    await queryRunner.query(`
      ALTER TABLE "messages" 
      DROP COLUMN "parentMessageId"
    `);
  }
}
