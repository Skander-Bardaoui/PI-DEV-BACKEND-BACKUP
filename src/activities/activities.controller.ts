import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivitiesService } from './activities.service';
import { ActivityType } from './entities/activity.entity';

@Controller('activities')
@UseGuards(AuthGuard('jwt'))
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('business/:businessId')
  findByBusiness(@Param('businessId') businessId: string, @Request() req) {
    return this.activitiesService.findByBusiness(businessId, req.user.id);
  }

  @Post('test-create')
  async testCreate(@Body() body: { businessId: string; taskId?: string; subtaskId?: string }, @Request() req) {
    console.log('🧪 Test create activity:', body);
    return this.activitiesService.createActivity({
      type: ActivityType.SUBTASK_COMPLETED,
      businessId: body.businessId,
      userId: req.user.id,
      taskId: body.taskId,
      subtaskId: body.subtaskId,
      description: 'Test activity',
    });
  }
}
