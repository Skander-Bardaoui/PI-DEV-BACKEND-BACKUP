// src/platform-admin/dto/suspend-tenant.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class SuspendTenantDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
