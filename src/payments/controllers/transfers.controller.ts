import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TransfersService } from '../services/transfers.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CreateTransferSchema } from '../dto/create-transfer.dto';

@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  // POST /transfers
  @Post()
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateTransferSchema)) dto: any,
  ) {
    return this.transfersService.create(req.user.business_id, req.user.id, dto);
  }
}
