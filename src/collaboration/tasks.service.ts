// src/collaboration/tasks.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Role } from '../users/enums/role.enum';
import { PermissionUtil } from '../businesses/utils/permission.util';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,

    @InjectRepository(BusinessMember)
    private memberRepo: Repository<BusinessMember>,
  ) {}

  // ─── Get member with role check ────────────────────
  private async getMember(userId: string, businessId: string): Promise<BusinessMember> {
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId, is_active: true },
      relations: ['user'],
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    return member;
  }

  // ─── Check if user has permission ──────────────────
  private hasPermission(member: BusinessMember, permissionKey: string): boolean {
    // BUSINESS_OWNER always has full access
    if (member.role === Role.BUSINESS_OWNER) {
      return true;
    }

    // All other roles (including BUSINESS_ADMIN) must check their collaboration_permissions object
    return PermissionUtil.hasGranularPermission(member.collaboration_permissions, permissionKey);
  }

  // ─── Verify business membership ────────────────────
  async hasAccess(userId: string, businessId: string): Promise<boolean> {
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId, is_active: true },
    });

    return !!member;
  }

  // ─── CREATE ────────────────────────────────────────
  async createTask(dto: any, userId: string) {
    // Verify user is member of business and has CREATE permission
    const member = await this.getMember(userId, dto.businessId);
    
    if (!this.hasPermission(member, 'create_task')) {
      throw new ForbiddenException('You do not have permission to create tasks');
    }

    const task = this.taskRepo.create({
      ...dto,
      createdById: userId,
    });

    return this.taskRepo.save(task);
  }

  // ─── GET ALL ───────────────────────────────────────
  async getTasks(businessId: string, userId: string) {
    // Verify user is member of business (read access is granted to all members)
    await this.getMember(userId, businessId);

    return this.taskRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── UPDATE ────────────────────────────────────────
  async updateTask(id: string, dto: any, userId: string) {
    const task = await this.taskRepo.findOne({ where: { id } });

    if (!task) throw new NotFoundException('Task not found');

    // Verify user is member of business and has UPDATE permission
    const member = await this.getMember(userId, task.businessId!);
    
    if (!this.hasPermission(member, 'update_task')) {
      throw new ForbiddenException('You do not have permission to update tasks');
    }

    Object.assign(task, dto);

    if (dto.status === TaskStatus.DONE) {
      task.completedAt = new Date();
    }

    return this.taskRepo.save(task);
  }

  // ─── DELETE ────────────────────────────────────────
  async deleteTask(id: string, userId: string) {
    const task = await this.taskRepo.findOne({ where: { id } });

    if (!task) throw new NotFoundException('Task not found');

    // Verify user is member of business and has DELETE permission
    const member = await this.getMember(userId, task.businessId!);
    
    if (!this.hasPermission(member, 'delete_task')) {
      throw new ForbiddenException('You do not have permission to delete tasks');
    }

    await this.taskRepo.delete(id);

    return { message: 'Task deleted' };
  }
}
