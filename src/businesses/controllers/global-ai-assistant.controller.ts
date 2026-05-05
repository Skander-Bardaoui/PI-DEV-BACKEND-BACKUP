// src/businesses/controllers/global-ai-assistant.controller.ts
import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { GlobalAiAssistantService, GlobalQueryResult } from '../services/global-ai-assistant.service';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsString()
  @IsNotEmpty()
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content: string;
}

class ChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  history?: MessageDto[];
}

@Controller('businesses/:businessId/ai-assistant')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GlobalAiAssistantController {
  constructor(private readonly service: GlobalAiAssistantService) {}

  @Post('chat')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async chat(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ChatDto,
  ): Promise<GlobalQueryResult> {
    if (!dto.question || !dto.question.trim()) {
      throw new BadRequestException('La question est requise');
    }
    return this.service.chat(businessId, dto.question, dto.history || []);
  }
}
