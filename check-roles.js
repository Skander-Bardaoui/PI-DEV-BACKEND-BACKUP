// check-roles.js
// Script to check what roles exist in the database

const { Client } = require('pg');
require('dotenv').config();

async function checkRoles() {
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

    // Check all distinct roles
    const rolesQuery = `
      SELECT DISTINCT role, COUNT(*) as count
      FROM business_members
      GROUP BY role
      ORDER BY count DESC
    `;

    const rolesResult = await client.query(rolesQuery);
    console.log('\n📋 Roles in business_members table:');
    rolesResult.rows.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} member(s)`);
    });

    // Check all members with their permissions
    const membersQuery = `
      SELECT 
        id,
        user_id,
        role,
        payment_permissions
      FROM business_members
      LIMIT 10
    `;

    const membersResult = await client.query(membersQuery);
    console.log('\n📋 Sample members (first 10):');
    membersResult.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Member ID: ${row.id}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   Role: ${row.role}`);
      console.log(`   Payment Permissions:`, row.payment_permissions);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the check
checkRoles()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
