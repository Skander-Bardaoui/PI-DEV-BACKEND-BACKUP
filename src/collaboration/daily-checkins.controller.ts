import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DailyCheckinsService } from './daily-checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Controller('checkins')
@UseGuards(AuthGuard('jwt'))
export class DailyCheckinsController {
  constructor(
    private readonly checkinsService: DailyCheckinsService,
  ) {}

  // ─── CREATE CHECK-IN ───────────────────────────────
  @Post()
  create(@Body() dto: CreateCheckinDto, @Request() req) {
    return this.checkinsService.createCheckin(dto, req.user.id);
  }

  // ─── CHECK IF USER CHECKED IN TODAY ────────────────
  @Get('today')
  hasCheckedInToday(@Request() req) {
    return this.checkinsService.hasCheckedInToday(req.user.id);
  }

  // ─── GET BUSINESS CHECK-INS FOR TODAY ──────────────
  @Get('business/:businessId/today')
  getBusinessCheckinsToday(
    @Param('businessId') businessId: string,
    @Request() req,
  ) {
    return this.checkinsService.getBusinessCheckinsToday(
      businessId,
      req.user.id,
    );
  }
}
