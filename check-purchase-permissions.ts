import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkPurchasePermissions() {
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
    console.log('✅ Connected to database\n');

    const members = await dataSource.query(`
      SELECT id, role, purchase_permissions
      FROM business_members
      WHERE is_active = true
    `);

    console.log('Business Members Purchase Permissions:\n');
    members.forEach((m: any) => {
      console.log(`Member: ${m.id}`);
      console.log(`Role: ${m.role}`);
      console.log('Purchase Permissions:', JSON.stringify(m.purchase_permissions, null, 2));
      console.log('---\n');
    });

    await dataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPurchasePermissions();
