// seed-platform-admin.js
// Quick script to seed the platform admin account

const axios = require('axios');
require('dotenv').config();

const BACKEND_URL = 'http://localhost:3001';

async function seedPlatformAdmin() {
  try {
    const email = process.env.PLATFORM_ADMIN_EMAIL || 'admin@noventra.com';
    const password = process.env.PLATFORM_ADMIN_PASSWORD || 'SuperSecure123!@#';

    console.log('🌱 Seeding platform admin...');
    console.log(`Email: ${email}`);

    const response = await axios.post(`${BACKEND_URL}/platform/auth/seed`, {
      email,
      password,
    });

    console.log('✅ Success:', response.data.message);
    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n🔗 Login at: http://localhost:5173/console/login');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.data.message);
      
      if (error.response.data.message === 'Platform admin already exists') {
        console.log('\n✅ Platform admin already exists. You can login with:');
        console.log(`   Email: ${process.env.PLATFORM_ADMIN_EMAIL || 'admin@noventra.com'}`);
        console.log(`   Password: ${process.env.PLATFORM_ADMIN_PASSWORD || 'SuperSecure123!@#'}`);
        console.log('\n🔗 Login at: http://localhost:5173/console/login');
      }
    } else {
      console.error('❌ Error:', error.message);
      console.log('\n⚠️  Make sure the backend is running on http://localhost:3001');
    }
    process.exit(1);
  }
}

seedPlatformAdmin();
