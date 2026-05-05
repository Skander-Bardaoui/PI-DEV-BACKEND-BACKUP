// src/businesses/guards/integration-example.ts
// This file demonstrates how to integrate PermissionGuard with existing controllers

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BusinessAccessGuard } from './business-access.guard';
import { PermissionGuard } from './permission.guard';
import { Role } from '../../users/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorators';
import { AllBusinessMembers } from '../decorators/business-access.decorator';
import {
  RequireCreate,
  RequireUpdate,
  RequireDelete,
  RequireAddMember,
  RequireKickMember,
  RequirePromote,
} from '../decorators/permission.decorator';

/**
 * Example controller showing how to integrate PermissionGuard
 * with existing business-scoped routes
 */
@Controller('businesses')
@UseGuards(
  AuthGuard('jwt'),        // JWT authentication (existing)
  RolesGuard,              // Role-based access (existing)
  BusinessAccessGuard,     // Business membership validation (existing)
  PermissionGuard          // Permission-based access (NEW - add this last)
)
export class ExampleIntegratedController {

  // ─── READ OPERATIONS (No permission required) ────────────────────────────
  
  @Get(':id/products')
  @AllBusinessMembers()  // All business members can view products
  async getProducts(@Param('id') businessId: string) {
    // No permission decorator = no permission requirement
    // Any business member can access this route
    return { message: 'Products list', businessId };
  }

  // ─── CREATE OPERATIONS (Require CREATE permission) ───────────────────────

  @Post(':id/products')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.TEAM_MEMBER)
  @AllBusinessMembers()
  @RequireCreate()  // NEW: Requires 'c' permission
  async createProduct(
    @Param('id') businessId: string,
    @Body() createProductDto: any
  ) {
    // Only users with CREATE permission ('c' in position 0) can access
    return { message: 'Product created', businessId, data: createProductDto };
  }

  @Post(':id/categories')
  @AllBusinessMembers()
  @RequireCreate()  // NEW: Requires 'c' permission
  async createCategory(
    @Param('id') businessId: string,
    @Body() createCategoryDto: any
  ) {
    return { message: 'Category created', businessId, data: createCategoryDto };
  }

  // ─── UPDATE OPERATIONS (Require UPDATE permission) ───────────────────────

  @Patch(':id/products/:productId')
  @AllBusinessMembers()
  @RequireUpdate()  // NEW: Requires 'u' permission
  async updateProduct(
    @Param('id') businessId: string,
    @Param('productId') productId: string,
    @Body() updateProductDto: any
  ) {
    // Only users with UPDATE permission ('u' in position 1) can access
    return { message: 'Product updated', businessId, productId, data: updateProductDto };
  }

  @Patch(':id/settings')
  @AllBusinessMembers()
  @RequireUpdate()  // NEW: Requires 'u' permission
  async updateSettings(
    @Param('id') businessId: string,
    @Body() updateSettingsDto: any
  ) {
    return { message: 'Settings updated', businessId, data: updateSettingsDto };
  }

  // ─── DELETE OPERATIONS (Require DELETE permission) ───────────────────────

  @Delete(':id/products/:productId')
  @AllBusinessMembers()
  @RequireDelete()  // NEW: Requires 'd' permission
  async deleteProduct(
    @Param('id') businessId: string,
    @Param('productId') productId: string
  ) {
    // Only users with DELETE permission ('d' in position 2) can access
    return { message: 'Product deleted', businessId, productId };
  }

  // ─── MEMBER MANAGEMENT (Require specific permissions) ─────────────────────

  @Post(':id/invitations')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @AllBusinessMembers()
  @RequireAddMember()  // NEW: Requires 'a' permission
  async inviteMember(
    @Param('id') businessId: string,
    @Body() inviteDto: any
  ) {
    // Only users with ADD_MEMBER permission ('a' in position 3) can access
    return { message: 'Member invited', businessId, data: inviteDto };
  }

  @Delete(':id/members/:userId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @AllBusinessMembers()
  @RequireKickMember()  // NEW: Requires 'k' permission
  async removeMember(
    @Param('id') businessId: string,
    @Param('userId') userId: string,
    @Request() req
  ) {
    // Only users with KICK_MEMBER permission ('k' in position 4) can access
    // Prevent self-removal
    if (req.user.id === userId) {
      throw new Error('Cannot remove yourself');
    }
    return { message: 'Member removed', businessId, userId };
  }

  @Patch(':id/members/:userId/role')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @AllBusinessMembers()
  @RequirePromote()  // NEW: Requires 'p' permission
  async updateMemberRole(
    @Param('id') businessId: string,
    @Param('userId') userId: string,
    @Body() roleDto: any,
    @Request() req
  ) {
    // Only users with PROMOTE permission ('p' in position 5) can access
    // Prevent self-promotion
    if (req.user.id === userId) {
      throw new Error('Cannot change your own role');
    }
    return { message: 'Member role updated', businessId, userId, data: roleDto };
  }

  // ─── MIXED PERMISSIONS EXAMPLE ───────────────────────────────────────────

  @Post(':id/bulk-operations')
  @AllBusinessMembers()
  @RequireCreate()  // Could also require multiple permissions in business logic
  async bulkOperations(
    @Param('id') businessId: string,
    @Body() bulkDto: any
  ) {
    // This route requires CREATE permission
    // Additional permission checks could be done in the service layer
    // based on the specific operations being performed
    return { message: 'Bulk operations completed', businessId, data: bulkDto };
  }
}

/**
 * MIGRATION GUIDE: How to add PermissionGuard to existing controllers
 * 
 * 1. Add PermissionGuard to the @UseGuards decorator (after existing guards)
 * 2. Import permission decorators from '../decorators/permission.decorator'
 * 3. Add appropriate permission decorators to routes:
 *    - @RequireCreate() for POST routes that create resources
 *    - @RequireUpdate() for PATCH/PUT routes that modify resources
 *    - @RequireDelete() for DELETE routes
 *    - @RequireAddMember() for routes that invite/add members
 *    - @RequireKickMember() for routes that remove members
 *    - @RequirePromote() for routes that change member roles/permissions
 * 4. Routes without permission decorators remain accessible to all business members
 * 5. Platform admins automatically bypass all permission checks
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing routes without permission decorators continue to work unchanged
 * - Only routes with permission decorators enforce the new permission system
 * - All existing role-based and business access controls remain in effect
 */