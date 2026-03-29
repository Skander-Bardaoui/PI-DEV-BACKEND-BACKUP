// src/businesses/decorators/business-access.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { BUSINESS_ACCESS_KEY, BusinessAccessConfig } from '../guards/business-access.guard';

export const BusinessAccess = (config: BusinessAccessConfig) =>
  SetMetadata(BUSINESS_ACCESS_KEY, config);

// Predefined configurations for common scenarios
export const OwnerOnly = () =>
  BusinessAccess({
    allowOwner: true,
    allowAdmin: false,
    allowMember: false,
    allowAccountant: false,
  });

export const OwnerAndAdmin = () =>
  BusinessAccess({
    allowOwner: true,
    allowAdmin: true,
    allowMember: false,
    allowAccountant: false,
  });

export const AllBusinessMembers = () =>
  BusinessAccess({
    allowOwner: true,
    allowAdmin: true,
    allowMember: true,
    allowAccountant: true,
  });

export const OwnerAdminAccountant = () =>
  BusinessAccess({
    allowOwner: true,
    allowAdmin: true,
    allowMember: false,
    allowAccountant: true,
  });
