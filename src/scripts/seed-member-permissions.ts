#!/usr/bin/env ts-node

/**
 * Script to seed existing business members with role-based default permissions
 * 
 * Usage:
 *   npm run seed:permissions
 *   or
 *   npx ts-node src/scripts/seed-member-permissions.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BusinessMembersService } from '../businesses/services/business-members.service';

async function seedMemberPermissions() {
  console.log('🚀 Starting permission seeding script...');
  
  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the BusinessMembersService
    const businessMembersService = app.get(BusinessMembersService);
    
    // Execute the seeding
    const result = await businessMembersService.seedExistingMembersWithDefaultPermissions();
    
    console.log('✅ Permission seeding completed successfully!');
    console.log(`📊 Results: ${result.updated} updated, ${result.skipped} skipped`);
    
    // Close the application context
    await app.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during permission seeding:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  seedMemberPermissions();
}

export { seedMemberPermissions };