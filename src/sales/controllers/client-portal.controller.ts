// src/sales/controllers/client-portal.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientPortalService } from '../services/client-portal.service';

@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly service: ClientPortalService) {}

  @Get('data')
  @HttpCode(HttpStatus.OK)
  getPortalData(@Query('token') token: string) {
    return this.service.getPortalData(token);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirmOrder(@Body('token') token: string) {
    return this.service.confirmOrder(token);
  }

  @Post('refuse')
  @HttpCode(HttpStatus.OK)
  refuseOrder(
    @Body('token') token: string,
    @Body('reason') reason: string,
  ) {
    return this.service.refuseOrder(token, reason);
  }
}
