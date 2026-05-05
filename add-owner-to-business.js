// add-owner-to-business.js
// Script to add BUSINESS_OWNER to their business with full permissions

const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function addOwnerToBusiness() {
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

    // Get BUSINESS_OWNER user
    const ownerQuery = `SELECT id, email, "firstName", "lastName" FROM users WHERE role = 'BUSINESS_OWNER' LIMIT 1`;
    const ownerResult = await client.query(ownerQuery);
    
    if (ownerResult.rows.length === 0) {
      console.log('\n❌ No BUSINESS_OWNER user found');
      return;
    }

    const owner = ownerResult.rows[0];
    console.log(`\n📋 BUSINESS_OWNER user:`);
    console.log(`   ID: ${owner.id}`);
    console.log(`   Email: ${owner.email}`);

    // Get first business
    const businessQuery = 'SELECT id, name FROM businesses LIMIT 1';
    const businessResult = await client.query(businessQuery);
    
    if (businessResult.rows.length === 0) {
      console.log('\n❌ No business found');
      return;
    }

    const business = businessResult.rows[0];
    console.log(`\n📋 Business:`);
    console.log(`   ID: ${business.id}`);
    console.log(`   Name: ${business.name}`);

    // Check if already a member
    const checkQuery = `
      SELECT id FROM business_members 
      WHERE business_id = $1 AND user_id = $2
    `;
    const checkResult = await client.query(checkQuery, [business.id, owner.id]);
    
    if (checkResult.rows.length > 0) {
      console.log('\n⚠️  Owner is already a member of this business');
      console.log('   Updating permissions instead...');
      
      const updateQuery = `
        UPDATE business_members SET
          role = 'BUSINESS_OWNER',
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
        WHERE business_id = $1 AND user_id = $2
      `;
      
      await client.query(updateQuery, [business.id, owner.id]);
      console.log('   ✅ Permissions updated!');
    } else {
      console.log('\n➕ Adding owner to business...');
      
      const insertQuery = `
        INSERT INTO business_members (
          id,
          business_id,
          user_id,
          role,
          is_active,
          collaboration_permissions,
          stock_permissions,
          payment_permissions,
          invited_by,
          invited_at,
          joined_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `;
      
      const now = new Date();
      const memberId = uuidv4();
      
      await client.query(insertQuery, [
        memberId,
        business.id,
        owner.id,
        'BUSINESS_OWNER',
        true,
        {
          create_task: true,
          update_task: true,
          delete_task: true,
          add_member: true,
          kick_member: true,
          promote_member: true
        },
        {
          create_product: true,
          update_product: true,
          delete_product: true,
          create_movement: true,
          delete_movement: true,
          create_category: true,
          update_category: true,
          delete_category: true,
          create_warehouse: true,
          update_warehouse: true,
          delete_warehouse: true,
          create_reservation: true,
          delete_reservation: true,
          create_service: true,
          update_service: true,
          delete_service: true,
          create_service_category: true,
          update_service_category: true,
          delete_service_category: true
        },
        {
          create_client_payment: true,
          delete_client_payment: true,
          create_supplier_payment: true,
          delete_supplier_payment: true,
          create_schedule: true,
          update_schedule: true,
          delete_schedule: true,
          pay_installment: true,
          create_account: true,
          update_account: true,
          delete_account: true,
          create_transfer: true,
          delete_transfer: true
        },
        owner.id,
        now,
        now,
        now,
        now
      ]);
      
      console.log('   ✅ Owner added to business!');
    }

    // Verify
    const verifyQuery = `
      SELECT 
        id,
        role,
        collaboration_permissions,
        stock_permissions,
        payment_permissions
      FROM business_members 
      WHERE business_id = $1 AND user_id = $2
    `;
    const verifyResult = await client.query(verifyQuery, [business.id, owner.id]);
    
    if (verifyResult.rows.length > 0) {
      const member = verifyResult.rows[0];
      console.log('\n✅ Verification:');
      console.log(`   Member ID: ${member.id}`);
      console.log(`   Role: ${member.role}`);
      console.log(`   Collaboration Permissions:`, member.collaboration_permissions);
      console.log(`   Stock Permissions:`, member.stock_permissions);
      console.log(`   Payment Permissions:`, member.payment_permissions);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
addOwnerToBusiness()
  .then(() => {
    console.log('\n🎉 BUSINESS_OWNER setup complete!');
    console.log('   You can now login and use all payment features.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
