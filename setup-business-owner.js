// setup-business-owner.js
// Script to check businesses and add BUSINESS_OWNER to business_members if needed

const { Client } = require('pg');
require('dotenv').config();

async function setupBusinessOwner() {
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

    // Check businesses
    const businessesQuery = 'SELECT id, name, tenant_id FROM businesses LIMIT 10';
    const businessesResult = await client.query(businessesQuery);
    console.log(`\n📋 Total businesses: ${businessesResult.rows.length}`);
    
    if (businessesResult.rows.length > 0) {
      console.log('\nBusinesses:');
      businessesResult.rows.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name} (ID: ${business.id})`);
      });
    }

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
    console.log(`   Name: ${owner.firstName} ${owner.lastName}`);

    // Check if owner is in business_members
    const memberCheckQuery = `
      SELECT bm.*, b.name as business_name
      FROM business_members bm
      JOIN businesses b ON b.id = bm.business_id
      WHERE bm.user_id = $1
    `;
    const memberCheckResult = await client.query(memberCheckQuery, [owner.id]);
    
    console.log(`\n📋 Owner memberships: ${memberCheckResult.rows.length}`);
    
    if (memberCheckResult.rows.length > 0) {
      console.log('\nMemberships:');
      
      for (let index = 0; index < memberCheckResult.rows.length; index++) {
        const membership = memberCheckResult.rows[index];
        console.log(`\n${index + 1}. Business: ${membership.business_name}`);
        console.log(`   Role: ${membership.role}`);
        console.log(`   Payment Permissions:`, membership.payment_permissions);
        
        // If payment_permissions is null or missing keys, update it
        if (!membership.payment_permissions || 
            !membership.payment_permissions.create_client_payment) {
          console.log(`   ⚠️  Payment permissions need to be updated!`);
          
          const updateQuery = `
            UPDATE business_members SET
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
            WHERE id = $1
          `;
          
          await client.query(updateQuery, [membership.id]);
          console.log(`   ✅ Payment permissions updated!`);
        } else {
          console.log(`   ✅ Payment permissions already set`);
        }
      }
    } else {
      console.log('\n⚠️  BUSINESS_OWNER is not a member of any business');
      console.log('   You need to create a business first or add the owner to an existing business');
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

// Run the setup
setupBusinessOwner()
  .then(() => {
    console.log('\n✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
