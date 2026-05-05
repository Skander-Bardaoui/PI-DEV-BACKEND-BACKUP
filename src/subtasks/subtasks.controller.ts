import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubtasksService } from './subtasks.service';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { GenerateSubtasksDto } from './dto/generate-subtasks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../users/enums/role.enum';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';

@Controller('subtasks')
@UseGuards(JwtAuthGuard)
export class SubtasksController {
  constructor(
    private readonly subtasksService: SubtasksService,
    @InjectRepository(BusinessMember)
    private businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  /**
   * Check if user has permission to perform subtask operation
   */
  private async checkSubtaskPermission(
    userId: string,
    taskId: string,
    operation: 'create_subtask' | 'update_subtask' | 'delete_subtask' | 'mark_complete_subtask',
  ): Promise<void> {
    // Get task to access businessId
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new ForbiddenException('Task not found');
    }

    // Get member permissions
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: task.businessId, user_id: userId, is_active: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    // BUSINESS_OWNER bypasses all checks
    if (member.role === Role.BUSINESS_OWNER) {
      return;
    }

    // Check permission (default to false if missing)
    const hasPermission = member.collaboration_permissions?.[operation] === true;

    if (!hasPermission) {
      throw new ForbiddenException(`You don't have permission to ${operation.replace(/_/g, ' ')}`);
    }
  }

  // Tout le monde peut voir les subtasks
  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: string) {
    return this.subtasksService.findByTask(taskId);
  }

  // Obtenir la progression d'une tâche
  @Get('task/:taskId/progress')
  getTaskProgress(@Param('taskId') taskId: string) {
    return this.subtasksService.getTaskProgress(taskId);
  }

  // Seuls BUSINESS_OWNER et BUSINESS_ADMIN peuvent créer manuellement
  @Post()
  async create(@Body() createSubtaskDto: CreateSubtaskDto, @Request() req) {
    // Check permission
    await this.checkSubtaskPermission(req.user.id, createSubtaskDto.taskId, 'create_subtask');
    
    return this.subtasksService.create(createSubtaskDto);
  }

  // Seuls BUSINESS_OWNER et BUSINESS_ADMIN peuvent générer avec AI
  @Post('generate')
  @UseGuards(AiFeatureGuard)
  async generateSubtasks(@Body() generateDto: GenerateSubtasksDto, @Request() req) {
    console.log('📥 Received generate request:', generateDto);
    
    // Check permission
    await this.checkSubtaskPermission(req.user.id, generateDto.taskId, 'create_subtask');
    
    return this.subtasksService.generateSubtasks(generateDto);
  }

  @Get('test-groq')
  async testGroq() {
    // Simple test endpoint to verify Groq API key
    return {
      message: 'Groq API test endpoint',
      hasApiKey: !!process.env.GROQ_API_KEY_NOUHA,
      keyPrefix: process.env.GROQ_API_KEY_NOUHA?.substring(0, 10),
    };
  }

  // TEAM_MEMBER peut cocher (isCompleted), mais seuls OWNER/ADMIN peuvent renommer
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateSubtaskDto: UpdateSubtaskDto, @Request() req) {
    // Get subtask to find taskId
    const subtask = await this.subtasksService.findOne(id);
    if (!subtask) {
      throw new ForbiddenException('Subtask not found');
    }
    
    // Check permission
    await this.checkSubtaskPermission(req.user.id, subtask.taskId, 'update_subtask');
    
    return this.subtasksService.update(id, updateSubtaskDto);
  }

  // Endpoint spécifique pour TEAM_MEMBER - marque comme complété ET compte pour la progression
  @Post(':id/mark-complete')
  async markCompleteByTeamMember(
    @Param('id') id: string,
    @Body() body: { businessId: string },
    @Request() req,
  ) {
    // Get subtask to find taskId
    const subtask = await this.subtasksService.findOne(id);
    if (!subtask) {
      throw new ForbiddenException('Subtask not found');
    }
    
    // Check permission
    await this.checkSubtaskPermission(req.user.id, subtask.taskId, 'mark_complete_subtask');
    
    return this.subtasksService.markCompleteByTeamMember(id, req.user.id, body.businessId);
  }

  // Seuls BUSINESS_OWNER et BUSINESS_ADMIN peuvent supprimer
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    // Get subtask to find taskId
    const subtask = await this.subtasksService.findOne(id);
    if (!subtask) {
      throw new ForbiddenException('Subtask not found');
    }
    
    // Check permission
    await this.checkSubtaskPermission(req.user.id, subtask.taskId, 'delete_subtask');
    
    return this.subtasksService.remove(id);
  }
}
