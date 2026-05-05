import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AccountsService } from '../services/accounts.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CreateAccountSchema } from '../dto/create-account.dto';
import { UpdateAccountSchema } from '../dto/update-account.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // POST /accounts
  @Post()
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateAccountSchema)) dto: any,
  ) {
    return this.accountsService.create(req.user.business_id, req.user.id, dto);
  }

  // GET /accounts
  @Get()
  async findAll(@Req() req: any) {
    return this.accountsService.findAll(req.user.business_id);
  }

  // GET /accounts/balance
  @Get('balance')
  async getTotalBalance(@Req() req: any) {
    return this.accountsService.getTotalBalance(req.user.business_id);
  }

  // GET /accounts/:id
  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.findOne(req.user.business_id, id);
  }

  // GET /accounts/:id/balance
  @Get(':id/balance')
  async getBalance(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.getBalance(req.user.business_id, id);
  }

  // PATCH /accounts/:id
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateAccountSchema)) dto: any,
  ) {
    return this.accountsService.update(req.user.business_id, req.user.id, id, dto);
  }

  // PATCH /accounts/:id/toggle-active
  @Patch(':id/toggle-active')
  async toggleActive(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.toggleActive(req.user.business_id, req.user.id, id);
  }
}
