import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { Task } from '../tasks/entities/task.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { User } from '../users/entities/user.entity';
import { BusinessMembersService } from '../businesses/services/business-members.service';
import { Business } from '../businesses/entities/business.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, BusinessMember, User, Business, Tenant]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService, BusinessMembersService],
})
export class StatisticsModule {}
