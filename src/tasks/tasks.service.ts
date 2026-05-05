import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from './entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { DetectPriorityDto } from './dto/detect-priority.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';
import { BusinessMembersService } from '../businesses/services/business-members.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityType } from '../activities/entities/activity.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private businessMembersService: BusinessMembersService,
    private dataSource: DataSource,
    @Inject(forwardRef(() => MessagesGateway))
    private messagesGateway: MessagesGateway,
    private configService: ConfigService,
    @Inject(forwardRef(() => ActivitiesService))
    private activitiesService: ActivitiesService,
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

    // Get the highest order for the status
    const taskStatus = createTaskDto.status || TaskStatus.TODO;
    const maxOrderTask = await this.taskRepository.findOne({
      where: { businessId, status: taskStatus },
      order: { order: 'DESC' },
    });
    const newOrder = maxOrderTask ? maxOrderTask.order + 1 : 0;

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
      order: newOrder,
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
      order: { status: 'ASC', order: 'ASC' },
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

  async moveTask(
    id: string,
    moveTaskDto: MoveTaskDto,
    userId: string,
  ): Promise<Task> {
    const task = await this.findOne(id, userId);
    const { status: newStatus, order: newOrder, priority: newPriority } = moveTaskDto;
    const oldStatus = task.status;
    const oldOrder = task.order;

    console.log('MoveTask DTO received:', { newStatus, newOrder, newPriority });
    console.log('Current task priority:', task.priority);

    // Check if task is being moved to BLOCKED status
    const isMovingToBlocked = oldStatus !== TaskStatus.BLOCKED && newStatus === TaskStatus.BLOCKED;

    // Use transaction to ensure atomicity
    const updatedTask = await this.dataSource.transaction(async (manager) => {
      const taskRepo = manager.getRepository(Task);

      // If status changed
      if (oldStatus !== newStatus) {
        // Decrease order of tasks after the old position in old column
        await taskRepo
          .createQueryBuilder()
          .update(Task)
          .set({ order: () => '"order" - 1' })
          .where('businessId = :businessId', { businessId: task.businessId })
          .andWhere('status = :status', { status: oldStatus })
          .andWhere('"order" > :oldOrder', { oldOrder })
          .execute();

        // Increase order of tasks at or after the new position in new column
        await taskRepo
          .createQueryBuilder()
          .update(Task)
          .set({ order: () => '"order" + 1' })
          .where('businessId = :businessId', { businessId: task.businessId })
          .andWhere('status = :status', { status: newStatus })
          .andWhere('"order" >= :newOrder', { newOrder })
          .execute();

        // Update the task
        task.status = newStatus;
        task.order = newOrder;
      } else {
        // Same column reordering
        if (newOrder < oldOrder) {
          // Moving up: increase order of tasks between new and old position
          await taskRepo
            .createQueryBuilder()
            .update(Task)
            .set({ order: () => '"order" + 1' })
            .where('businessId = :businessId', { businessId: task.businessId })
            .andWhere('status = :status', { status: oldStatus })
            .andWhere('"order" >= :newOrder', { newOrder })
            .andWhere('"order" < :oldOrder', { oldOrder })
            .execute();
        } else if (newOrder > oldOrder) {
          // Moving down: decrease order of tasks between old and new position
          await taskRepo
            .createQueryBuilder()
            .update(Task)
            .set({ order: () => '"order" - 1' })
            .where('businessId = :businessId', { businessId: task.businessId })
            .andWhere('status = :status', { status: oldStatus })
            .andWhere('"order" > :oldOrder', { oldOrder })
            .andWhere('"order" <= :newOrder', { newOrder })
            .execute();
        }

        task.order = newOrder;
      }

      // Update priority if provided
      if (newPriority !== undefined && newPriority !== null) {
        console.log('Updating priority to:', newPriority);
        task.priority = newPriority;
      }

      const savedTask = await taskRepo.save(task);
      console.log('Task saved with priority:', savedTask.priority);
      return savedTask;
    });

    // Log activity if task moved to BLOCKED
    if (isMovingToBlocked) {
      try {
        console.log('🚫 Task moved to BLOCKED - creating activity');
        await this.activitiesService.createActivity({
          type: ActivityType.TASK_BLOCKED,
          businessId: task.businessId,
          userId,
          taskId: task.id,
          description: `Task moved to BLOCKED: ${task.title}`,
          isOverdue: true,
        });
        console.log('✅ BLOCKED activity created');
      } catch (error) {
        console.error('❌ Failed to create BLOCKED activity:', error);
      }
    }

    // Emit WebSocket event
    this.messagesGateway.emitTaskMoved(task.businessId, {
      taskId: task.id,
      newStatus: newStatus,
      newOrder: newOrder,
      movedBy: userId,
    });

    return updatedTask;
  }

  async detectPriority(detectPriorityDto: DetectPriorityDto): Promise<{ priority: TaskPriority }> {
    const { title, description } = detectPriorityDto;
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY_NOUHA');

    if (!groqApiKey) {
      throw new BadRequestException('GROQ_API_KEY_NOUHA is not configured');
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a task priority classifier. Classify the task as LOW, MEDIUM or HIGH based on the title and description. Return ONLY one word: LOW, MEDIUM or HIGH. No explanation, no punctuation, just the priority level.',
            },
            {
              role: 'user',
              content: `Title: ${title}\nDescription: ${description || 'No description provided'}`,
            },
          ],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', errorText);
        throw new BadRequestException('Failed to detect priority');
      }

      const data = await response.json();
      const detectedPriority = data.choices[0]?.message?.content?.trim().toUpperCase();

      // Validate the response
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(detectedPriority)) {
        console.warn('Invalid priority detected:', detectedPriority);
        return { priority: TaskPriority.MEDIUM }; // Default fallback
      }

      return { priority: detectedPriority as TaskPriority };
    } catch (error) {
      console.error('Error detecting priority:', error);
      // Return default priority on error
      return { priority: TaskPriority.MEDIUM };
    }
  }

  async improveDescription(improveDescriptionDto: ImproveDescriptionDto): Promise<{ improved: string }> {
    const { title, description } = improveDescriptionDto;
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY_NOUHA');

    if (!groqApiKey) {
      throw new BadRequestException('GROQ_API_KEY_NOUHA is not configured');
    }

    try {
      const userMessage = title 
        ? `Task Title: ${title}\n\nCurrent Description: ${description}`
        : `Current Description: ${description}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a project management assistant. Improve or complete the given task description. Make it clear, professional and actionable. Keep it concise (max 3 sentences). Return ONLY the improved description, nothing else. Keep the same language as the input.',
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', errorText);
        throw new BadRequestException('Failed to improve description');
      }

      const data = await response.json();
      const improvedDescription = data.choices[0]?.message?.content?.trim();

      if (!improvedDescription) {
        console.warn('No improved description received');
        return { improved: description }; // Return original if no improvement
      }

      return { improved: improvedDescription };
    } catch (error) {
      console.error('Error improving description:', error);
      // Return original description on error
      return { improved: description };
    }
  }
}
