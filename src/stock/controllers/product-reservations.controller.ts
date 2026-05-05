// ==================== Alaa change for product reservations ====================
import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  UsePipes,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProductReservationsService } from '../services/product-reservations.service';
import {
  CreateReservationDto,
  ReservationResponseDto,
} from '../dto/product-reservation.dto';

@Controller('products/reservations')
@UseGuards(JwtAuthGuard)
export class ProductReservationsController {
  constructor(
    private readonly reservationsService: ProductReservationsService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createReservation(
    @Req() req: any,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const businessId = req.user?.business_id;
    return this.reservationsService.createReservation(businessId, dto);
  }

  @Get()
  async getReservations(
    @Req() req: any,
  ): Promise<ReservationResponseDto[]> {
    try {
      const businessId = req.user?.business_id;
      console.log('Getting reservations for business:', businessId);
      const result = await this.reservationsService.getReservations(businessId);
      console.log('Reservations found:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getReservations controller:', error);
      throw error;
    }
  }

  @Delete(':productId')
  async clearReservation(
    @Req() req: any,
    @Param('productId') productId: string,
  ): Promise<{ message: string }> {
    const businessId = req.user?.business_id;
    await this.reservationsService.clearReservation(businessId, productId);
    return { message: 'Reservation cleared successfully' };
  }

  @Put(':productId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateReservation(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
  ): Promise<ReservationResponseDto> {
    const businessId = req.user?.business_id;
    return this.reservationsService.updateReservation(
      businessId,
      productId,
      quantity,
    );
  }
}
// ====================================================================
