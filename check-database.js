// check-database.js
// Script to check database structure

const { Client } = require('pg');
require('dotenv').config();

async function checkDatabase() {
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

    // Check if business_members table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'business_members'
      );
    `;

    const tableResult = await client.query(tableExistsQuery);
    console.log('\n📋 business_members table exists:', tableResult.rows[0].exists);

    if (tableResult.rows[0].exists) {
      // Check table structure
      const columnsQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'business_members'
        ORDER BY ordinal_position;
      `;

      const columnsResult = await client.query(columnsQuery);
      console.log('\n📋 business_members table columns:');
      columnsResult.rows.forEach((row) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });

      // Check if payment_permissions column exists
      const hasPaymentPermissions = columnsResult.rows.some(
        row => row.column_name === 'payment_permissions'
      );
      console.log('\n✅ payment_permissions column exists:', hasPaymentPermissions);

      // Count total members
      const countQuery = 'SELECT COUNT(*) as total FROM business_members';
      const countResult = await client.query(countQuery);
      console.log('✅ Total members in table:', countResult.rows[0].total);
    }

    // Check users table
    const usersCountQuery = 'SELECT COUNT(*) as total FROM users';
    const usersResult = await client.query(usersCountQuery);
    console.log('\n📋 Total users in users table:', usersResult.rows[0].total);

    // Check users with roles
    const usersRolesQuery = `
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `;
    const usersRolesResult = await client.query(usersRolesQuery);
    console.log('\n📋 User roles in users table:');
    usersRolesResult.rows.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} user(s)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the check
checkDatabase()
  .then(() => {
    console.log('\n✅ Database check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
