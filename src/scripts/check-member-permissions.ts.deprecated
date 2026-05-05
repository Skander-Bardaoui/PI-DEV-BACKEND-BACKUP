#!/usr/bin/env ts-node

/**
 * Script to check current business member permissions
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BusinessMembersService } from '../businesses/services/business-members.service';
import { Repository } from 'typeorm';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

async function checkMemberPermissions() {
  console.log('🔍 Checking current business member permissions...');
  
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
      select: {
        id: true,
        role: true,
        permissions: true,
        user: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    });
    
    console.log(`📊 Found ${allMembers.length} total business members`);
    
    if (allMembers.length === 0) {
      console.log('ℹ️  No business members found in database');
    } else {
      console.log('\n📋 Current permissions:');
      console.log('─'.repeat(80));
      
      allMembers.forEach((member, index) => {
        console.log(`${index + 1}. ${member.user.firstName} ${member.user.lastName} (${member.user.email})`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Permissions: ${member.permissions}`);
        console.log('');
      });
      
      // Count by permission patterns
      const permissionCounts = allMembers.reduce((acc, member) => {
        acc[member.permissions] = (acc[member.permissions] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📈 Permission distribution:');
      Object.entries(permissionCounts).forEach(([permissions, count]) => {
        console.log(`   ${permissions}: ${count} members`);
      });
      
      // Count members with default permissions
      const defaultPermissionMembers = allMembers.filter(m => m.permissions === '------');
      console.log(`\n🎯 Members with default permissions (------): ${defaultPermissionMembers.length}`);
    }
    
    // Close the application context
    await app.close();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking permissions:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  checkMemberPermissions();
}

export { checkMemberPermissions };