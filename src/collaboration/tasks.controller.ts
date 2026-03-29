// src/collaboration/tasks.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── CREATE TASK ───────────────────────────────
  @Post()
  create(@Body() dto: any, @Request() req) {
    return this.tasksService.createTask(dto, req.user.id);
  }

  // ─── GET TASKS BY BUSINESS ─────────────────────
  @Get('business/:businessId')
  findAll(@Param('businessId') businessId: string) {
    return this.tasksService.getTasks(businessId);
  }

  // ─── UPDATE TASK ───────────────────────────────
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req,
  ) {
    return this.tasksService.updateTask(id, dto, req.user.id);
  }

  // ─── DELETE TASK ───────────────────────────────
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.tasksService.deleteTask(id, req.user.id);
  }
}