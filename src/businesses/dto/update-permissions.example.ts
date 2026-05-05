// src/businesses/dto/update-permissions.example.ts
// This file demonstrates how to use the UpdatePermissionsDto in a controller

import { Body, Controller, Param, Patch } from '@nestjs/common';
import { UpdatePermissionsDto } from './update-permissions.dto';

/**
 * Example controller method showing how to use UpdatePermissionsDto
 * This is for demonstration purposes only - the actual implementation
 * will be in the business members controller
 */
@Controller('example')
export class ExampleController {
  @Patch('businesses/:businessId/members/:userId/permissions')
  async updateMemberPermissions(
    @Param('businessId') businessId: string,
    @Param('userId') userId: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    // The DTO will automatically validate that the objects are valid
    
    const { collaboration_permissions, stock_permissions } = updatePermissionsDto;
    
    // At this point, permissions are guaranteed to be valid objects
    console.log('Valid collaboration permissions received:', collaboration_permissions);
    console.log('Valid stock permissions received:', stock_permissions);
    
    // Example usage:
    // collaboration_permissions?.create_task
    // collaboration_permissions?.update_task
    // stock_permissions?.create_product
    // stock_permissions?.update_product
    
    return {
      businessId,
      userId,
      collaboration_permissions,
      stock_permissions,
      message: 'Permissions would be updated',
    };
  }
}

/**
 * Example validation scenarios:
 * 
 * ✅ Valid requests:
 * POST /example/businesses/123/members/456/permissions
 * Body: { 
 *   "collaboration_permissions": {
 *     "create_task": true,
 *     "update_task": true,
 *     "delete_task": false
 *   }
 * }
 * 
 * POST /example/businesses/123/members/456/permissions
 * Body: { 
 *   "stock_permissions": {
 *     "create_product": true,
 *     "update_product": true
 *   }
 * }
 * 
 * POST /example/businesses/123/members/456/permissions
 * Body: { 
 *   "collaboration_permissions": { "create_task": true },
 *   "stock_permissions": { "create_product": true }
 * }
 */