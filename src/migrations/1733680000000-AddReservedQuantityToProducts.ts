// ==================== Alaa change for product reservations ====================
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReservedQuantityToProducts1733680000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'reserved_quantity',
        type: 'decimal',
        precision: 15,
        scale: 3,
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('products', 'reserved_quantity');
  }
}
// ====================================================================
