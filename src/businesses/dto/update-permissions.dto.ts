// src/businesses/dto/update-permissions.dto.ts
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdatePermissionsDto {
  @IsOptional()
  @IsString({ message: 'Permissions must be a string' })
  @Length(6, 6, { message: 'Permissions must be exactly 6 characters long' })
  @Matches(/^[cu-][ud-][da-][ak-][kp-][p-]$/, {
    message: 'Invalid permission string format. Must be 6 characters with valid permission characters (c,u,d,a,k,p) or dashes (-) in correct positions',
  })
  permissions?: string;

  @IsOptional()
  @IsObject({ message: 'Collaboration permissions must be an object' })
  collaboration_permissions?: Record<string, boolean>;

  @IsOptional()
  @IsObject({ message: 'Stock permissions must be an object' })
  stock_permissions?: Record<string, boolean>;

  @IsOptional()
  @IsObject({ message: 'Payment permissions must be an object' })
  payment_permissions?: Record<string, boolean>;

  @IsOptional()
  @IsObject({ message: 'Salary permissions must be an object' })
  salary_permissions?: Record<string, boolean>;

  @IsOptional()
  @IsObject({ message: 'Sales permissions must be an object' })
  sales_permissions?: Record<string, boolean>;

  @IsOptional()
  @IsObject({ message: 'Purchase permissions must be an object' })
  purchase_permissions?: Record<string, boolean>;
}
