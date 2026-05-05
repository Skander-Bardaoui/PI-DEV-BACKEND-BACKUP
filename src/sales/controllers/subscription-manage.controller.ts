// src/sales/controllers/subscription-manage.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionManageService } from '../services/subscription-manage.service';

@Controller('subscription-manage')
export class SubscriptionManageController {
  constructor(private readonly service: SubscriptionManageService) {}

  @Get('data')
  @HttpCode(HttpStatus.OK)
  getData(@Query('token') token: string) {
    return this.service.getSubscriptionData(token);
  }

  @Post('continue')
  @HttpCode(HttpStatus.OK)
  continueSubscription(@Body('token') token: string) {
    return this.service.continueSubscription(token);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancelSubscription(
    @Body('token') token: string,
    @Body('reason') reason: string,
  ) {
    return this.service.cancelSubscription(token, reason);
  }
}
