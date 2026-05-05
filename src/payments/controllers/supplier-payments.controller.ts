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
import Stripe from 'stripe';


@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly svc: SupplierPaymentsService) {}

  @Post('stripe/create-intent')
async createStripeIntent(
  @Param('businessId', ParseUUIDPipe) businessId: string,
  @Body() body: { amount: number },
) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia',
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(body.amount * 100),
    currency: 'eur',
    metadata: { businessId },
  });

  return { clientSecret: paymentIntent.client_secret };
}
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
