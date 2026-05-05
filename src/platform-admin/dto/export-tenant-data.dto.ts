// src/platform-admin/dto/export-tenant-data.dto.ts
import { IsUUID } from 'class-validator';

export class ExportTenantDataDto {
  @IsUUID()
  tenantId: string;
}
