// fix-business-owner-permissions.js
// Script to update all BUSINESS_OWNER members with full permissions

const { Client } = require('pg');
require('dotenv').config();

async function fixBusinessOwnerPermissions() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Update all BUSINESS_OWNER members with full permissions
    const updateQuery = `
      UPDATE business_members SET
        collaboration_permissions = '{
          "create_task": true,
          "update_task": true,
          "delete_task": true,
          "add_member": true,
          "kick_member": true,
          "promote_member": true
        }'::jsonb,
        stock_permissions = '{
          "create_product": true,
          "update_product": true,
          "delete_product": true,
          "create_movement": true,
          "delete_movement": true,
          "create_category": true,
          "update_category": true,
          "delete_category": true,
          "create_warehouse": true,
          "update_warehouse": true,
          "delete_warehouse": true,
          "create_reservation": true,
          "delete_reservation": true,
          "create_service": true,
          "update_service": true,
          "delete_service": true,
          "create_service_category": true,
          "update_service_category": true,
          "delete_service_category": true
        }'::jsonb,
        payment_permissions = '{
          "create_client_payment": true,
          "delete_client_payment": true,
          "create_supplier_payment": true,
          "delete_supplier_payment": true,
          "create_schedule": true,
          "update_schedule": true,
          "delete_schedule": true,
          "pay_installment": true,
          "create_account": true,
          "update_account": true,
          "delete_account": true,
          "create_transfer": true,
          "delete_transfer": true
        }'::jsonb
      WHERE role = 'BUSINESS_OWNER'
    `;

    const result = await client.query(updateQuery);
    console.log(`✅ Updated ${result.rowCount} BUSINESS_OWNER member(s)`);

    // Verify the update
    const verifyQuery = `
      SELECT 
        id,
        user_id,
        role,
        collaboration_permissions,
        stock_permissions,
        payment_permissions
      FROM business_members 
      WHERE role = 'BUSINESS_OWNER'
      LIMIT 5
    `;

    const verifyResult = await client.query(verifyQuery);
    console.log('\n📋 Verification - BUSINESS_OWNER members:');
    verifyResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Member ID: ${row.id}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   Role: ${row.role}`);
      console.log(`   Collaboration Permissions:`, row.collaboration_permissions);
      console.log(`   Stock Permissions:`, row.stock_permissions);
      console.log(`   Payment Permissions:`, row.payment_permissions);
    });

    // Count total BUSINESS_OWNER members
    const countQuery = `
      SELECT COUNT(*) as total
      FROM business_members 
      WHERE role = 'BUSINESS_OWNER'
    `;

    const countResult = await client.query(countQuery);
    console.log(`\n✅ Total BUSINESS_OWNER members: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the fix
fixBusinessOwnerPermissions()
  .then(() => {
    console.log('\n🎉 BUSINESS_OWNER permissions fixed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to fix permissions:', error);
    process.exit(1);
  });
