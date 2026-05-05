// src/platform-admin/dto/reject-tenant.dto.ts
import { IsString, MinLength } from 'class-validator';

export class RejectTenantDto {
  @IsString()
  @MinLength(10)
  reason!: string;
}
