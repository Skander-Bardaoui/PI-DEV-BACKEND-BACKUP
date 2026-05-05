// src/collaboration/collaboration.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { DailyCheckin } from './entities/daily-checkin.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Business } from '../businesses/entities/business.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DailyCheckinsController } from './daily-checkins.controller';
import { DailyCheckinsService } from './daily-checkins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, DailyCheckin, BusinessMember, Business, Tenant, User]),
  ],
  controllers: [TasksController, DailyCheckinsController],
  providers: [TasksService, DailyCheckinsService],
  exports: [TasksService, DailyCheckinsService],
})
export class CollaborationModule {}
