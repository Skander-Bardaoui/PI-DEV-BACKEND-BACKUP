import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '.env') });

enum Role {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  BUSINESS_ADMIN = 'BUSINESS_ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  TEAM_MEMBER = 'TEAM_MEMBER',
}

function getRoleDefaultPurchasePermissions(role: Role): Record<string, boolean> {
  if (role === Role.BUSINESS_OWNER || role === Role.PLATFORM_ADMIN) {
    return {
      create_supplier: true,
      update_supplier: true,
      delete_supplier: true,
      invite_supplier: true,
      create_purchase_order: true,
      update_purchase_order: true,
      delete_purchase_order: true,
      send_purchase_order: true,
      confirm_purchase_order: true,
      create_goods_receipt: true,
      update_goods_receipt: true,
      delete_goods_receipt: true,
      validate_goods_receipt: true,
      create_purchase_invoice: true,
      update_purchase_invoice: true,
      delete_purchase_invoice: true,
      pay_purchase_invoice: true,
      create_purchase_return: true,
      update_purchase_return: true,
      delete_purchase_return: true,
      approve_purchase_return: true,
    };
  }
  
  if (role === Role.BUSINESS_ADMIN) {
    return {
      create_supplier: true,
      update_supplier: true,
      delete_supplier: false,
      invite_supplier: true,
      create_purchase_order: true,
      update_purchase_order: true,
      delete_purchase_order: false,
      send_purchase_order: true,
      confirm_purchase_order: true,
      create_goods_receipt: true,
      update_goods_receipt: true,
      delete_goods_receipt: false,
      validate_goods_receipt: true,
      create_purchase_invoice: true,
      update_purchase_invoice: true,
      delete_purchase_invoice: false,
      pay_purchase_invoice: true,
      create_purchase_return: true,
      update_purchase_return: true,
      delete_purchase_return: false,
      approve_purchase_return: true,
    };
  }
  
  if (role === Role.ACCOUNTANT) {
    return {
      create_supplier: true,
      update_supplier: true,
      delete_supplier: false,
      invite_supplier: false,
      create_purchase_order: false,
      update_purchase_order: false,
      delete_purchase_order: false,
      send_purchase_order: false,
      confirm_purchase_order: false,
      create_goods_receipt: false,
      update_goods_receipt: false,
      delete_goods_receipt: false,
      validate_goods_receipt: false,
      create_purchase_invoice: true,
      update_purchase_invoice: true,
      delete_purchase_invoice: false,
      pay_purchase_invoice: true,
      create_purchase_return: false,
      update_purchase_return: false,
      delete_purchase_return: false,
      approve_purchase_return: false,
    };
  }
  
  // TEAM_MEMBER and others have minimal permissions
  return {
    create_supplier: false,
    update_supplier: false,
    delete_supplier: false,
    invite_supplier: false,
    create_purchase_order: false,
    update_purchase_order: false,
    delete_purchase_order: false,
    send_purchase_order: false,
    confirm_purchase_order: false,
    create_goods_receipt: false,
    update_goods_receipt: false,
    delete_goods_receipt: false,
    validate_goods_receipt: false,
    create_purchase_invoice: false,
    update_purchase_invoice: false,
    delete_purchase_invoice: false,
    pay_purchase_invoice: false,
    create_purchase_return: false,
    update_purchase_return: false,
    delete_purchase_return: false,
    approve_purchase_return: false,
  };
}

async function fixPurchasePermissions() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'pi_dev',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    // Get all business members
    const members = await dataSource.query(`
      SELECT id, role, purchase_permissions
      FROM business_members
      WHERE is_active = true
    `);

    console.log(`\n📊 Found ${members.length} active business members`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const member of members) {
      const currentPermissions = member.purchase_permissions || {};
      const hasAnyPermission = Object.keys(currentPermissions).length > 0;

      if (hasAnyPermission) {
        console.log(`⏭️  Skipping member ${member.id} (${member.role}) - already has purchase permissions`);
        skippedCount++;
        continue;
      }

      const defaultPermissions = getRoleDefaultPurchasePermissions(member.role as Role);

      await dataSource.query(
        `UPDATE business_members 
         SET purchase_permissions = $1 
         WHERE id = $2`,
        [JSON.stringify(defaultPermissions), member.id]
      );

      console.log(`✅ Updated member ${member.id} (${member.role}) with default purchase permissions`);
      updatedCount++;
    }

    console.log(`\n📈 Summary:`);
    console.log(`   - Updated: ${updatedCount} members`);
    console.log(`   - Skipped: ${skippedCount} members (already had permissions)`);
    console.log(`   - Total: ${members.length} members`);

    await dataSource.destroy();
    console.log('\n✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixPurchasePermissions();
