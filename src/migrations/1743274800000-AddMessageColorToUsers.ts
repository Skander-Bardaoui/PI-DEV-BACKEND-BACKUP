import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMessageColorToUsers1743274800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'messageColor',
        type: 'varchar',
        length: '7',
        isNullable: true,
        default: "'#4F46E5'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'messageColor');
  }
}
