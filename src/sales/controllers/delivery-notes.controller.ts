import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeliveryNotesService } from '../services/delivery-notes.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { CreateDeliveryNoteDto } from '../dto/create-delivery-note.dto';
import { UpdateDeliveryNoteDto } from '../dto/update-delivery-note.dto';

@Controller('businesses/:businessId/delivery-notes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateDeliveryNoteDto,
  ) {
    return this.service.create(businessId, dto);
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: any,
  ) {
    return this.service.findAll(businessId, query);
  }

  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryNoteDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Post(':id/deliver')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  markDelivered(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markDelivered(businessId, id);
  }

  @Post(':id/cancel')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(businessId, id);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(businessId, id);
  }
}
