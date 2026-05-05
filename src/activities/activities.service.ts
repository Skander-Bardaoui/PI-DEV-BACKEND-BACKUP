import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Activity, ActivityType } from './entities/activity.entity';
import { BusinessMembersService } from '../businesses/services/business-members.service';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    private businessMembersService: BusinessMembersService,
  ) {}

  async createActivity(data: {
    type: ActivityType;
    businessId: string;
    userId: string;
    taskId?: string;
    subtaskId?: string;
    description?: string;
    isOverdue?: boolean;
    isOnTime?: boolean;
  }): Promise<Activity> {
    console.log('📝 Creating activity:', data);
    const activity = this.activityRepository.create(data);
    const saved = await this.activityRepository.save(activity);
    const statusEmoji = saved.isOverdue ? '⚠️ OVERDUE' : saved.isOnTime ? '✅ ON TIME' : '';
    console.log('✅ Activity created:', saved.id, statusEmoji);
    return saved;
  }

  async findByBusiness(businessId: string, userId: string): Promise<Activity[]> {
    console.log('🔍 findByBusiness called:', { businessId, userId });

    // Check if user has access to this business
    const hasAccess = await this.businessMembersService.hasAccess(userId, businessId);
    console.log('✅ Has access:', hasAccess);
    
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    // Check if user is OWNER or ADMIN
    const userRole = await this.businessMembersService.getUserRoleInBusiness(userId, businessId);
    console.log('👤 User role:', userRole);
    
    if (!userRole || (userRole !== 'BUSINESS_OWNER' && userRole !== 'BUSINESS_ADMIN')) {
      throw new ForbiddenException('Only business owners and admins can view activities');
    }

    // Get all activities for this business (no date filter for now to debug)
    console.log('📊 Fetching activities...');
    const activities = await this.activityRepository.find({
      where: {
        businessId,
      },
      relations: ['user', 'task', 'subtask'],
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });

    console.log(`✅ Found ${activities.length} activities`);
    activities.forEach(a => {
      console.log('  -', a.type, '|', a.user?.email, '|', a.subtask?.title || a.task?.title);
    });

    return activities;
  }
}
