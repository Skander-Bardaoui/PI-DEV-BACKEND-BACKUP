import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SubtasksController } from './subtasks.controller';
import { SubtasksService } from './subtasks.service';
import { Subtask } from './entities/subtask.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Business } from '../businesses/entities/business.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subtask, BusinessMember, Task, Subscription, Tenant, Business]),
    HttpModule,
    ConfigModule,
  ],
  controllers: [SubtasksController],
  providers: [SubtasksService, AiFeatureGuard],
  exports: [SubtasksService],
})
export class SubtasksModule {}
