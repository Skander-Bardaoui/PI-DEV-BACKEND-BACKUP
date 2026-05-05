// src/sales/controllers/quote-portal.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { QuotePortalService } from '../services/quote-portal.service';

@Controller('quote-portal')
export class QuotePortalController {
  constructor(private readonly service: QuotePortalService) {}

  @Get('data')
  async getPortalData(@Query('token') token: string) {
    return this.service.getPortalData(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async acceptQuote(@Body('token') token: string) {
    return this.service.acceptQuote(token);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  async rejectQuote(
    @Body('token') token: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.rejectQuote(token, reason);
  }
}
