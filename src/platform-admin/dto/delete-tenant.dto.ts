// src/platform-admin/dto/delete-tenant.dto.ts
import { IsString, IsUUID, MinLength } from 'class-validator';

export class DeleteTenantDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  adminPassword: string;

  @IsString()
  @MinLength(1, { message: 'Export token is required' })
  exportToken: string; // Token from the export to ensure data was exported
}
