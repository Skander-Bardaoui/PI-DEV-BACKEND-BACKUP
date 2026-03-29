import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ClientPortalToken } from '../entities/client-portal-token.entity';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { Client } from '../../clients/entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';
import { DeliveryNote } from '../entities/delivery-note.entity';
import { DeliveryNoteItem } from '../entities/delivery-note-item.entity';

@Injectable()
export class ClientPortalService {
  constructor(
    @InjectRepository(ClientPortalToken)
    private readonly tokenRepo: Repository<ClientPortalToken>,

    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async generatePortalToken(
    businessId: string,
    clientId: string,
    salesOrderId: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const portalToken = this.tokenRepo.create({
      token,
      business_id: businessId,
      client_id: clientId,
      sales_order_id: salesOrderId,
      expires_at: expiresAt,
      used: false,
    });

    await this.tokenRepo.save(portalToken);
    return token;
  }

  async getPortalData(token: string) {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: [
        'business',
        'client',
        'salesOrder',
        'salesOrder.items',
        'salesOrder.client',
        'salesOrder.business',
      ],
    });

    if (!portalToken) {
      throw new NotFoundException('Token invalide ou expiré');
    }

    if (portalToken.used) {
      throw new BadRequestException('Ce lien a déjà été utilisé');
    }

    if (new Date() > portalToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    return {
      business: portalToken.business,
      client: portalToken.client,
      salesOrder: portalToken.salesOrder,
      token: portalToken.token,
    };
  }

  async confirmOrder(token: string): Promise<SalesOrder> {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: ['salesOrder'],
    });

    if (!portalToken) throw new NotFoundException('Token invalide');
    if (portalToken.used) throw new BadRequestException('Ce lien a déjà été utilisé');
    if (new Date() > portalToken.expires_at) throw new BadRequestException('Ce lien a expiré');

    const order = portalToken.salesOrder;

    if (order.status !== SalesOrderStatus.CONFIRMED) {
      throw new BadRequestException('Cette commande ne peut plus être confirmée');
    }

    portalToken.used = true;
    await this.tokenRepo.save(portalToken);

    return this.dataSource.transaction(async (manager) => {
      const year = new Date().getFullYear();
      const prefix = `BL-${year}-`;

      const result = await manager.query(
        `SELECT COALESCE(
          MAX(CAST(SUBSTRING("deliveryNoteNumber" FROM ${prefix.length + 1}) AS INTEGER)),
          0
        ) + 1 AS next_seq
        FROM delivery_notes
        WHERE "businessId" = $1
          AND "deliveryNoteNumber" LIKE $2`,
        [portalToken.business_id, `${prefix}%`],
      );

      const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
      const deliveryNoteNumber = `${prefix}${seq}`;

      const deliveryNote = manager.create(DeliveryNote, {
        businessId: portalToken.business_id,
        clientId: portalToken.client_id,
        salesOrderId: order.id,
        deliveryNoteNumber,
        deliveryDate: new Date(),
        status: 'pending',
        notes: `Bon de livraison pour commande ${order.orderNumber} - Confirmé par le client`,
      });
      const savedDeliveryNote = await manager.save(DeliveryNote, deliveryNote);

      const orderItems = await manager.query(
        `SELECT * FROM sales_order_items WHERE "salesOrderId" = $1`,
        [order.id],
      );

      for (const item of orderItems) {
        const deliveryNoteItem = manager.create(DeliveryNoteItem, {
          deliveryNoteId: savedDeliveryNote.id,
          description: item.description,
          quantity: item.quantity,
          deliveredQuantity: 0,
        });
        await manager.save(DeliveryNoteItem, deliveryNoteItem);
      }

      order.status = SalesOrderStatus.IN_PROGRESS;
      await manager.save(SalesOrder, order);

      return order;
    });
  }

  async refuseOrder(token: string, reason: string): Promise<SalesOrder> {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: ['salesOrder'],
    });

    if (!portalToken) throw new NotFoundException('Token invalide');
    if (portalToken.used) throw new BadRequestException('Ce lien a déjà été utilisé');
    if (new Date() > portalToken.expires_at) throw new BadRequestException('Ce lien a expiré');

    const order = portalToken.salesOrder;

    if (order.status !== SalesOrderStatus.CONFIRMED) {
      throw new BadRequestException('Cette commande ne peut plus être refusée');
    }

    portalToken.used = true;
    await this.tokenRepo.save(portalToken);

    order.status = SalesOrderStatus.CANCELLED;
    order.notes = (order.notes || '') + `\n\nRefusée par le client: ${reason}`;
    await this.orderRepo.save(order);

    return order;
  }
}