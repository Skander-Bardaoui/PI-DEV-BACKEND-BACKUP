import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BusinessMembersService } from '../businesses/services/business-members.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private businessMembersService: BusinessMembersService,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    // If businessId is not provided, get the first business the user belongs to
    let businessId = createTaskDto.businessId;
    
    if (!businessId) {
      throw new BadRequestException('Business ID is required');
    }

    // Check if user has access to this business
    const hasAccess = await this.businessMembersService.hasAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    // Get assigned users if provided
    let assignedUsers: User[] = [];
    if (createTaskDto.assignedToIds && createTaskDto.assignedToIds.length > 0) {
      assignedUsers = await this.userRepository.find({
        where: { id: In(createTaskDto.assignedToIds) },
      });
    }

    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      priority: createTaskDto.priority,
      status: createTaskDto.status,
      dueDate: createTaskDto.dueDate,
      businessId,
      createdById: userId,
      assignedTo: assignedUsers,
    });

    return this.taskRepository.save(task);
  }

  async findAllByBusiness(businessId: string, userId: string): Promise<Task[]> {
    // Check if user has access to this business
    const hasAccess = await this.businessMembersService.hasAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    return this.taskRepository.find({
      where: { businessId },
      relations: ['assignedTo', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy', 'business'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check if user has access to this business
    const hasAccess = await this.businessMembersService.hasAccess(userId, task.businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this task');
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    const task = await this.findOne(id, userId);

    // Update assigned users if provided
    if (updateTaskDto.assignedToIds !== undefined) {
      if (updateTaskDto.assignedToIds.length > 0) {
        task.assignedTo = await this.userRepository.find({
          where: { id: In(updateTaskDto.assignedToIds) },
        });
      } else {
        task.assignedTo = [];
      }
    }

    // Update other fields
    if (updateTaskDto.title !== undefined) task.title = updateTaskDto.title;
    if (updateTaskDto.description !== undefined) task.description = updateTaskDto.description;
    if (updateTaskDto.priority !== undefined) task.priority = updateTaskDto.priority;
    if (updateTaskDto.status !== undefined) task.status = updateTaskDto.status;
    if (updateTaskDto.dueDate !== undefined) task.dueDate = updateTaskDto.dueDate;

    return this.taskRepository.save(task);
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id, userId);
    await this.taskRepository.remove(task);
  }
}
