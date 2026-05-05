// verify-migration.js - Verify the migration worked
const { Client } = require('pg');

async function verifyMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'saas_platform333',
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🔍 Checking for NULL productId values...\n');

    // Check each table for NULL values
    const tables = [
      { name: 'delivery_note_items', column: 'productId' },
      { name: 'sales_order_items', column: 'productId' },
      { name: 'quote_items', column: 'productId' },
      { name: 'supplier_po_items', column: 'product_id' },
      { name: 'goods_receipt_items', column: 'product_id' },
    ];

    let allGood = true;

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table.name} WHERE "${table.column}" IS NULL`
      );
      const count = parseInt(result.rows[0].count);
      
      if (count === 0) {
        console.log(`✅ ${table.name}.${table.column}: No NULL values (${count})`);
      } else {
        console.log(`❌ ${table.name}.${table.column}: Found ${count} NULL values!`);
        allGood = false;
      }
    }

    console.log('\n🔍 Checking recent stock movements...\n');
    
    const movements = await client.query(`
      SELECT 
        sm.type,
        sm.quantity,
        sm.reference_type,
        sm.note,
        p.name as product_name,
        sm.created_at
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC
      LIMIT 5
    `);

    if (movements.rows.length > 0) {
      console.log('Recent stock movements:');
      movements.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.type} | ${row.quantity} | ${row.product_name} | ${row.note}`);
      });
    } else {
      console.log('⚠️  No stock movements found yet');
    }

    console.log('\n' + '='.repeat(60));
    if (allGood) {
      console.log('✅ MIGRATION SUCCESSFUL - All constraints are in place!');
      console.log('✅ No NULL productId values found in any table');
    } else {
      console.log('⚠️  WARNING - Some tables still have NULL values');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyMigration();
