import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Patch,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard }        from 'src/auth/guards/jwt-auth.guard';
import { TransactionsService } from '../services/transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // GET /transactions
  @Get()
  async findAll(@Req() req: any) {
    return this.transactionsService.findAll(req.user.business_id);
  }

  // GET /transactions/training-data
  // must be before :id so it doesn't get caught by the UUID param route
  @Get('training-data')
  async getTrainingData(@Req() req: any) {
    return this.transactionsService.getTrainingData(req.user.business_id);
  }

  // GET /transactions/account/:accountId
  @Get('account/:accountId')
  async findByAccount(
    @Req() req: any,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    return this.transactionsService.findByAccount(req.user.business_id, accountId);
  }

  // PATCH /transactions/:id/fraud-review
  @Patch(':id/fraud-review')
  async updateFraudReview(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { is_fraud: boolean },
  ) {
    return this.transactionsService.updateFraudReview(
      req.user.business_id,
      id,
      body.is_fraud,
    );
  }

  // GET /transactions/:id — keep last so fixed routes above take priority
  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(req.user.business_id, id);
  }
}
