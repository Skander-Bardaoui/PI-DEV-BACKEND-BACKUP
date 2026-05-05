import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Subtask } from './entities/subtask.entity';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { GenerateSubtasksDto } from './dto/generate-subtasks.dto';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityType } from '../activities/entities/activity.entity';

@Injectable()
export class SubtasksService {
  constructor(
    @InjectRepository(Subtask)
    private subtaskRepository: Repository<Subtask>,
    private configService: ConfigService,
    private httpService: HttpService,
    @Inject(forwardRef(() => ActivitiesService))
    private activitiesService: ActivitiesService,
  ) {}

  async findByTask(taskId: string): Promise<Subtask[]> {
    return this.subtaskRepository.find({
      where: { taskId },
      order: { order: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Subtask | null> {
    return this.subtaskRepository.findOne({ where: { id } });
  }

  async getTaskProgress(taskId: string): Promise<{ completed: number; total: number; percentage: number }> {
    const subtasks = await this.findByTask(taskId);
    const total = subtasks.length;
    // Progression basée UNIQUEMENT sur les actions des TEAM_MEMBER
    const completed = subtasks.filter(s => s.isCompletedByTeamMember).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  async create(createSubtaskDto: CreateSubtaskDto): Promise<Subtask> {
    const subtask = this.subtaskRepository.create(createSubtaskDto);
    return this.subtaskRepository.save(subtask);
  }

  async update(id: string, updateSubtaskDto: UpdateSubtaskDto): Promise<Subtask> {
    const subtask = await this.subtaskRepository.findOne({ where: { id } });
    if (!subtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    Object.assign(subtask, updateSubtaskDto);
    return this.subtaskRepository.save(subtask);
  }

  async markCompleteByTeamMember(id: string, userId: string, businessId: string): Promise<Subtask> {
    console.log('✅ markCompleteByTeamMember called:', { id, userId, businessId });
    
    const subtask = await this.subtaskRepository.findOne({ 
      where: { id },
      relations: ['task'],
    });
    
    if (!subtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    console.log('📝 Subtask found:', subtask.title);
    console.log('📅 Task due date:', subtask.task?.dueDate);
    console.log('📊 Task status:', subtask.task?.status);

    // Check if overdue or on time
    const isOverdue = this.isTaskOverdue(subtask.task);
    const isOnTime = this.isTaskOnTime(subtask.task);
    console.log('⏰ Is overdue:', isOverdue);
    console.log('✅ Is on time:', isOnTime);

    // Marque comme complété ET compte pour la progression
    subtask.isCompleted = true;
    subtask.isCompletedByTeamMember = true;
    
    const savedSubtask = await this.subtaskRepository.save(subtask);
    console.log('💾 Subtask saved');

    // Enregistrer l'activité
    try {
      console.log('📝 Creating activity...');
      let activityType = ActivityType.SUBTASK_COMPLETED;
      let description = `Completed subtask: ${subtask.title}`;
      
      if (isOverdue) {
        activityType = ActivityType.SUBTASK_COMPLETED_OVERDUE;
        description = `Completed subtask OVERDUE: ${subtask.title}`;
      } else if (isOnTime) {
        activityType = ActivityType.SUBTASK_COMPLETED_ON_TIME;
        description = `Completed subtask ON TIME: ${subtask.title}`;
      }
      
      await this.activitiesService.createActivity({
        type: activityType,
        businessId,
        userId,
        taskId: subtask.taskId,
        subtaskId: subtask.id,
        description,
        isOverdue,
        isOnTime,
      });
      
      const statusLog = isOverdue ? '⚠️ MARKED AS OVERDUE' : isOnTime ? '✅ MARKED AS ON TIME' : '';
      console.log('✅ Activity created successfully', statusLog);
    } catch (error) {
      console.error('❌ Failed to create activity:', error);
      // Ne pas bloquer l'opération si l'activité échoue
    }
    
    return savedSubtask;
  }

  private isTaskOverdue(task: any): boolean {
    if (!task) return false;

    // Check if task is BLOCKED
    if (task.status === 'BLOCKED') {
      console.log('🚫 Task is BLOCKED - marking as overdue');
      return true;
    }

    // Check if task has due date and it's past
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare dates only
      
      if (dueDate < today) {
        console.log('📅 Due date passed - marking as overdue');
        return true;
      }
    }

    return false;
  }

  private isTaskOnTime(task: any): boolean {
    if (!task) return false;

    // Not on time if task is BLOCKED
    if (task.status === 'BLOCKED') {
      return false;
    }

    // Check if task has due date and completion is before or on due date
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare dates only
      
      if (today <= dueDate) {
        console.log('✅ Completed before/on due date - marking as on time');
        return true;
      }
    }

    return false;
  }

  async remove(id: string): Promise<void> {
    const result = await this.subtaskRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }
  }

  async generateSubtasks(generateDto: GenerateSubtasksDto): Promise<string[]> {
    const { taskTitle, taskDescription } = generateDto;

    console.log('🤖 Generate Subtasks Request:', {
      taskTitle,
      taskDescription: taskDescription.substring(0, 100),
    });

    const groqApiKey = this.configService.get<string>('GROQ_API_KEY_NOUHA');
    if (!groqApiKey) {
      console.error('❌ GROQ_API_KEY_NOUHA is not configured in environment');
      throw new BadRequestException('GROQ_API_KEY_NOUHA is not configured');
    }

    console.log('✅ Groq API Key found:', groqApiKey.substring(0, 10) + '...');

    const prompt = `You are a task management assistant. Based on the following task, generate between 5 to 8 short, actionable subtasks.

Task Title: ${taskTitle}
Task Description: ${taskDescription}

Return ONLY a valid JSON array of strings, with no additional text or explanation. Each string should be a concise subtask title (max 60 characters).

Example format: ["Subtask 1", "Subtask 2", "Subtask 3"]`;

    try {
      console.log('📡 Calling Groq API...');
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          },
          {
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      console.log('✅ Groq API Response received');
      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new BadRequestException('No response from AI');
      }

      console.log('📝 AI Response:', content);

      // Parse the JSON array from the response
      const cleanedContent = content.trim().replace(/```json\n?|\n?```/g, '');
      const subtasks = JSON.parse(cleanedContent);

      if (!Array.isArray(subtasks)) {
        throw new BadRequestException('AI response is not a valid array');
      }

      const filtered = subtasks.filter((s) => typeof s === 'string' && s.trim() !== '');
      console.log(`✅ Generated ${filtered.length} subtasks`);
      return filtered;
    } catch (error: any) {
      console.error('❌ Groq API Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new BadRequestException(
        `Failed to generate subtasks: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}
