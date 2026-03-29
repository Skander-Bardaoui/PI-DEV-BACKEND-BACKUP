import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupplierPaymentsService } from '../services/supplier-payments.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CreateSupplierPaymentSchema } from '../dto/supplier-payment.dto';


@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly svc: SupplierPaymentsService) {}

  // POST /businesses/:businessId/supplier-payments
  @Post()
  async create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(new ZodValidationPipe(CreateSupplierPaymentSchema)) dto: any,
    @Req() req: any,
  ) {
    return this.svc.create(businessId, req.user.id, dto);
  }

  // GET /businesses/:businessId/supplier-payments
  @Get()
  async findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.svc.findAll(businessId);
  }

  // GET /businesses/:businessId/supplier-payments/:id
  @Get(':id')
  async findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(businessId, id);
  }

  // GET /businesses/:businessId/supplier-payments/supplier/:supplierId
  @Get('supplier/:supplierId')
  async findBySupplier(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    return this.svc.findBySupplier(businessId, supplierId);
  }

  // GET /businesses/:businessId/supplier-payments/stats/:supplierId
  @Get('stats/:supplierId')
  async getStats(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    return this.svc.getSupplierStats(businessId, supplierId);
  }


}
