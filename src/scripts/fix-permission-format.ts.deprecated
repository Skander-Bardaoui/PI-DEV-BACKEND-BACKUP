#!/usr/bin/env ts-node

/**
 * Script to fix incorrect permission formats in existing data
 * This corrects permissions that were created with wrong position mapping
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Repository } from 'typeorm';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionUtil } from '../businesses/utils/permission.util';

async function fixPermissionFormat() {
  console.log('🔧 Fixing incorrect permission formats...');
  
  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the BusinessMember repository directly
    const businessMemberRepository = app.get<Repository<BusinessMember>>(
      getRepositoryToken(BusinessMember)
    );
    
    // Get all business members
    const allMembers = await businessMemberRepository.find({
      relations: ['user'],
    });
    
    console.log(`📊 Found ${allMembers.length} total business members`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const member of allMembers) {
      const currentPermissions = member.permissions;
      const correctPermissions = PermissionUtil.getRoleDefaultPermissions(member.role);
      
      // Check if current permissions don't match the correct format for the role
      if (currentPermissions !== correctPermissions) {
        console.log(`🔄 Fixing member ${member.user.firstName} ${member.user.lastName}:`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Current: ${currentPermissions}`);
        console.log(`   Correct: ${correctPermissions}`);
        
        member.permissions = correctPermissions;
        await businessMemberRepository.save(member);
        fixed++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n✅ Permission format fix completed!`);
    console.log(`📊 Results: ${fixed} fixed, ${skipped} already correct`);
    
    // Close the application context
    await app.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  fixPermissionFormat();
}

export { fixPermissionFormat };