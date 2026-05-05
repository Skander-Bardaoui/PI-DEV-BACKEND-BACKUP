// src/platform-admin/controllers/plan-management.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { PlanManagementService } from '../services/plan-management.service';
import { PlanSeedService } from '../services/plan-seed.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Controller('api/platform/plans')
@UseGuards(PlatformAdminGuard)
export class PlanManagementController {
  constructor(
    private readonly planService: PlanManagementService,
    private readonly planSeedService: PlanSeedService,
  ) {}

  // ─── List Plans ──────────────────────────────────────────────────────────
  @Get()
  async listPlans() {
    return this.planService.listPlans();
  }

  // ─── Seed Default Plans ──────────────────────────────────────────────────
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seedPlans() {
    await this.planSeedService.seedDefaultPlans();
    return { message: 'Default plans seeded successfully' };
  }

  // ─── Create Plan ─────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.planService.createPlan(dto);
  }

  // ─── Update Plan ─────────────────────────────────────────────────────────
  @Patch(':id')
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.updatePlan(id, dto);
  }

  // ─── Deactivate Plan ─────────────────────────────────────────────────────
  @Delete(':id')
  async deactivatePlan(@Param('id') id: string) {
    return this.planService.deactivatePlan(id);
  }
}