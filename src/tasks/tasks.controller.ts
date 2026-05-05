import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { DetectPriorityDto } from './dto/detect-priority.dto';
import { ImproveDescriptionDto } from './dto/improve-description.dto';

@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    return this.tasksService.create(createTaskDto, req.user.id);
  }

  @Get('business/:businessId')
  findAllByBusiness(@Param('businessId') businessId: string, @Request() req) {
    return this.tasksService.findAllByBusiness(businessId, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req) {
    return this.tasksService.update(id, updateTaskDto, req.user.id);
  }

  @Patch(':id/move')
  moveTask(@Param('id') id: string, @Body() moveTaskDto: MoveTaskDto, @Request() req) {
    return this.tasksService.moveTask(id, moveTaskDto, req.user.id);
  }

  @Post('detect-priority')
  detectPriority(@Body() detectPriorityDto: DetectPriorityDto) {
    return this.tasksService.detectPriority(detectPriorityDto);
  }

  @Post('improve-description')
  improveDescription(@Body() improveDescriptionDto: ImproveDescriptionDto) {
    return this.tasksService.improveDescription(improveDescriptionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.tasksService.remove(id, req.user.id);
  }
}
