import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
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

  // GET /transactions/:id
  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(req.user.business_id, id);
  }

  // GET /transactions/account/:accountId
  @Get('account/:accountId')
  async findByAccount(
    @Req() req: any,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    return this.transactionsService.findByAccount(req.user.business_id, accountId);
  }
}
