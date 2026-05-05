import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatisticsService, TeamStatistics } from './statistics.service';

@Controller('statistics')
@UseGuards(AuthGuard('jwt'))
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('team/:businessId')
  getTeamStatistics(@Param('businessId') businessId: string, @Request() req): Promise<TeamStatistics> {
    return this.statisticsService.getTeamStatistics(businessId, req.user.id);
  }
}
