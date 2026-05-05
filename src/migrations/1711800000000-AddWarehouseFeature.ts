import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn } from 'typeorm';

export class AddWarehouseFeature1711800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create warehouses table
    await queryRunner.createTable(
      new Table({
        name: 'warehouses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'IDX_warehouses_business_id',
            columnNames: ['business_id'],
          },
          {
            name: 'IDX_warehouses_business_id_is_active',
            columnNames: ['business_id', 'is_active'],
          },
          {
            name: 'IDX_warehouses_business_id_code',
            columnNames: ['business_id', 'code'],
            isUnique: true,
          },
        ],
      }),
      true,
    );

    // Add foreign key to businesses
    await queryRunner.createForeignKey(
      'warehouses',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'businesses',
        onDelete: 'CASCADE',
      }),
    );

    // Add warehouse_id column to products table
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'warehouse_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign key from products to warehouses
    await queryRunner.createForeignKey(
      'products',
      new TableForeignKey({
        columnNames: ['warehouse_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'warehouses',
        onDelete: 'SET NULL',
      }),
    );

    // Add warehouse_id column to stock_movements table
    await queryRunner.addColumn(
      'stock_movements',
      new TableColumn({
        name: 'warehouse_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign key from stock_movements to warehouses
    await queryRunner.createForeignKey(
      'stock_movements',
      new TableForeignKey({
        columnNames: ['warehouse_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'warehouses',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign keys
    const productsTable = await queryRunner.getTable('products');
    const productsFk = productsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('warehouse_id') !== -1,
    );
    if (productsFk) {
      await queryRunner.dropForeignKey('products', productsFk);
    }

    const stockMovementsTable = await queryRunner.getTable('stock_movements');
    const stockMovementsFk = stockMovementsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('warehouse_id') !== -1,
    );
    if (stockMovementsFk) {
      await queryRunner.dropForeignKey('stock_movements', stockMovementsFk);
    }

    // Remove columns
    await queryRunner.dropColumn('products', 'warehouse_id');
    await queryRunner.dropColumn('stock_movements', 'warehouse_id');

    // Drop warehouses table (will cascade delete foreign keys)
    await queryRunner.dropTable('warehouses');
  }
}
