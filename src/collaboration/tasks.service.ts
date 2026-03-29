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

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,

    @InjectRepository(BusinessMember)
    private memberRepo: Repository<BusinessMember>,
  ) {}

  // ─── Vérifier rôle ─────────────────────────────────
  async checkPermission(userId: string, businessId: string) {
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    const allowed =
      member.role === Role.BUSINESS_OWNER ||
      member.role === Role.BUSINESS_ADMIN;

    return { member, allowed };
  }

  // ─── CREATE ────────────────────────────────────────
  async createTask(dto: any, userId: string) {
    const { allowed } = await this.checkPermission(
      userId,
      dto.businessId,
    );

    if (!allowed) {
      throw new ForbiddenException('Not allowed');
    }

    const task = this.taskRepo.create({
      ...dto,
      createdById: userId,
    });

    return this.taskRepo.save(task);
  }

  // ─── GET ALL ───────────────────────────────────────
  async getTasks(businessId: string) {
    return this.taskRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── UPDATE ────────────────────────────────────────
  async updateTask(id: string, dto: any, userId: string) {
    const task = await this.taskRepo.findOne({ where: { id } });

    if (!task) throw new NotFoundException('Task not found');

    const { allowed } = await this.checkPermission(
      userId,
      task.businessId!,
    );

    if (!allowed) {
      throw new ForbiddenException('Not allowed');
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

    const { allowed } = await this.checkPermission(
      userId,
      task.businessId!,
    );

    if (!allowed) {
      throw new ForbiddenException('Not allowed');
    }

    await this.taskRepo.delete(id);

    return { message: 'Task deleted' };
  }
}