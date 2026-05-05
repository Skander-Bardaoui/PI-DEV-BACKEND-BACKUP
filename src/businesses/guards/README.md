# Permission Guard Usage Guide

This document explains how to use the new `PermissionGuard` and permission decorators to enforce granular permissions on business routes.

## Overview

The `PermissionGuard` works alongside the existing `BusinessAccessGuard` to provide fine-grained permission control using the 6-character permission string (cudakp).

## Basic Usage

### 1. Import Required Components

```typescript
import { UseGuards } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard';
import { RequireCreate, RequireUpdate, RequireDelete, RequireAddMember, RequireKickMember, RequirePromote } from './decorators/permission.decorator';
```

### 2. Apply Guards to Controller

```typescript
@Controller('businesses')
@UseGuards(AuthGuard('jwt'), RolesGuard, BusinessAccessGuard, PermissionGuard)
export class BusinessesController {
  // ... controller methods
}
```

### 3. Use Permission Decorators on Routes

```typescript
// Example: Require CREATE permission for creating resources
@Post(':id/products')
@RequireCreate()
async createProduct(@Param('id') businessId: string, @Body() dto: CreateProductDto) {
  // Only users with 'c' permission can access this route
  return this.productsService.create(businessId, dto);
}

// Example: Require UPDATE permission for updating resources
@Patch(':id/products/:productId')
@RequireUpdate()
async updateProduct(
  @Param('id') businessId: string,
  @Param('productId') productId: string,
  @Body() dto: UpdateProductDto
) {
  // Only users with 'u' permission can access this route
  return this.productsService.update(businessId, productId, dto);
}

// Example: Require DELETE permission for deleting resources
@Delete(':id/products/:productId')
@RequireDelete()
async deleteProduct(
  @Param('id') businessId: string,
  @Param('productId') productId: string
) {
  // Only users with 'd' permission can access this route
  return this.productsService.delete(businessId, productId);
}

// Example: Require ADD_MEMBER permission for inviting members
@Post(':id/invitations')
@RequireAddMember()
async inviteMember(@Param('id') businessId: string, @Body() dto: InviteMemberDto) {
  // Only users with 'a' permission can access this route
  return this.invitationsService.create(businessId, dto);
}

// Example: Require KICK_MEMBER permission for removing members
@Delete(':id/members/:userId')
@RequireKickMember()
async removeMember(
  @Param('id') businessId: string,
  @Param('userId') userId: string
) {
  // Only users with 'k' permission can access this route
  return this.businessMembersService.removeMember(businessId, userId);
}

// Example: Require PROMOTE permission for changing member roles
@Patch(':id/members/:userId/role')
@RequirePromote()
async updateMemberRole(
  @Param('id') businessId: string,
  @Param('userId') userId: string,
  @Body() dto: UpdateMemberRoleDto
) {
  // Only users with 'p' permission can access this route
  return this.businessMembersService.updateMemberRole(businessId, userId, dto.role);
}
```

## Advanced Usage

### Using Generic RequirePermission Decorator

```typescript
import { RequirePermission } from './decorators/permission.decorator';
import { PermissionType } from './utils/permission.util';

@Post(':id/custom-action')
@RequirePermission(PermissionType.CREATE)
async customAction(@Param('id') businessId: string) {
  // Custom permission requirement
}
```

### Combining with Existing Guards

The `PermissionGuard` is designed to work with existing guards:

```typescript
@Controller('businesses')
@UseGuards(
  AuthGuard('jwt'),        // JWT authentication
  RolesGuard,              // Role-based access
  BusinessAccessGuard,     // Business membership validation
  PermissionGuard          // Permission-based access (add this last)
)
export class BusinessesController {
  @Get(':id/sensitive-data')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)  // Role requirement
  @OwnerAndAdmin()                                   // Business access requirement
  @RequireUpdate()                                   // Permission requirement
  async getSensitiveData(@Param('id') businessId: string) {
    // User must:
    // 1. Be authenticated (JWT)
    // 2. Have BUSINESS_OWNER or BUSINESS_ADMIN role
    // 3. Be a member of the business with owner/admin access
    // 4. Have UPDATE permission in their permission string
  }
}
```

## Permission Types

The available permission types are:

- `PermissionType.CREATE` (0) - 'c' permission
- `PermissionType.UPDATE` (1) - 'u' permission  
- `PermissionType.DELETE` (2) - 'd' permission
- `PermissionType.ADD_MEMBER` (3) - 'a' permission
- `PermissionType.KICK_MEMBER` (4) - 'k' permission
- `PermissionType.PROMOTE` (5) - 'p' permission

## Business ID Resolution

The `PermissionGuard` automatically extracts the business ID from route parameters in this order:

1. `request.params.id`
2. `request.params.businessId`

Make sure your routes include one of these parameters:

```typescript
// ✅ Good - uses :id parameter
@Get(':id/products')

// ✅ Good - uses :businessId parameter  
@Get('custom/:businessId/products')

// ❌ Bad - no business ID parameter
@Get('products')
```

## Error Handling

The `PermissionGuard` throws `ForbiddenException` in these cases:

- User is not authenticated
- Business ID is missing from route parameters
- User is not a member of the specified business
- User lacks the required permission

## Platform Admin Bypass

Users with `Role.PLATFORM_ADMIN` automatically bypass all permission checks, similar to how they bypass other business access controls.

## Testing

When writing tests for routes with permission requirements, mock the business membership with appropriate permissions:

```typescript
const mockMembership = {
  id: 'member1',
  business_id: 'business1',
  user_id: 'user1',
  permissions: 'cu----', // CREATE and UPDATE permissions
  is_active: true,
};

mockBusinessMemberRepository.findOne.mockResolvedValue(mockMembership);
```