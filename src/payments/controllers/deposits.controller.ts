import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DepositsService } from '../services/deposits.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  // POST /deposits - Add money to an account
  @Post()
  async create(
    @Req() req: any,
    @Body() dto: {
      account_id: string;
      amount: number;
      description?: string;
      reference?: string;
      notes?: string;
      deposit_date?: string;
    },
  ) {
    return this.depositsService.create(
      req.user.business_id,
      req.user.id,
      dto,
    );
  }
}
