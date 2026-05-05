import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../tasks/entities/task.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { BusinessMembersService } from '../businesses/services/business-members.service';

export interface MemberStats {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  assigned: number;
  completed: number;
  overdue: number;
  inTime: number;
  completionRate: number;
  overdueRate: number;
  activityScore: number;
}

export interface TeamStatistics {
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    inTimeTasks: number;
    completionRate: number;
    overdueRate: number;
  };
  byStatus: {
    TODO: number;
    IN_PROGRESS: number;
    DONE: number;
    BLOCKED: number;
  };
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  members: MemberStats[];
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(BusinessMember)
    private businessMemberRepository: Repository<BusinessMember>,
    private businessMembersService: BusinessMembersService,
  ) {}

  async getTeamStatistics(
    businessId: string,
    userId: string,
  ): Promise<TeamStatistics> {
    // Check if user has access to this business
    const hasAccess = await this.businessMembersService.hasAccess(
      userId,
      businessId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    // Get all tasks for this business
    const tasks = await this.taskRepository.find({
      where: { businessId },
      relations: ['assignedTo'],
    });

    // Get all team members
    const members = await this.businessMemberRepository.find({
      where: { business_id: businessId },
      relations: ['user'],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate overview statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    
    const overdueTasks = tasks.filter((t) => {
      if (t.status === TaskStatus.DONE) return false;
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < today;
    }).length;

    const inTimeTasks = tasks.filter((t) => {
      if (t.status !== TaskStatus.DONE) return false;
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const completedDate = new Date(t.updatedAt);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate <= dueDate;
    }).length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

    // Calculate by status
    const byStatus = {
      TODO: tasks.filter((t) => t.status === TaskStatus.TODO).length,
      IN_PROGRESS: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      DONE: tasks.filter((t) => t.status === TaskStatus.DONE).length,
      BLOCKED: tasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
    };

    // Calculate by priority
    const byPriority = {
      LOW: tasks.filter((t) => t.priority === TaskPriority.LOW).length,
      MEDIUM: tasks.filter((t) => t.priority === TaskPriority.MEDIUM).length,
      HIGH: tasks.filter((t) => t.priority === TaskPriority.HIGH).length,
    };

    // Calculate per member statistics
    const memberStats: MemberStats[] = members.map((member) => {
      const memberTasks = tasks.filter((task) =>
        task.assignedTo?.some((user) => user.id === member.user_id),
      );

      const assigned = memberTasks.length;
      const completed = memberTasks.filter((t) => t.status === TaskStatus.DONE).length;
      
      const overdue = memberTasks.filter((t) => {
        if (t.status === TaskStatus.DONE) return false;
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        return dueDate < today;
      }).length;

      const inTime = memberTasks.filter((t) => {
        if (t.status !== TaskStatus.DONE) return false;
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const completedDate = new Date(t.updatedAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate <= dueDate;
      }).length;

      const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      const overdueRate = assigned > 0 ? Math.round((overdue / assigned) * 100) : 0;
      const activityScore = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      const name = member.user.firstName && member.user.lastName
        ? `${member.user.firstName} ${member.user.lastName}`
        : member.user.email;

      return {
        memberId: member.id,
        userId: member.user_id,
        name,
        email: member.user.email,
        role: member.role,
        assigned,
        completed,
        overdue,
        inTime,
        completionRate,
        overdueRate,
        activityScore,
      };
    });

    return {
      overview: {
        totalTasks,
        completedTasks,
        overdueTasks,
        inTimeTasks,
        completionRate,
        overdueRate,
      },
      byStatus,
      byPriority,
      members: memberStats,
    };
  }
}
