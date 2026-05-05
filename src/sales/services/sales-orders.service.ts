import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { SalesOrder } from '../entities/sales-order.entity';
import { SalesOrderItem } from '../entities/sales-order-item.entity';
import { SalesOrderStatus } from '../entities/sales-order.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { DeliveryNote } from '../entities/delivery-note.entity';
import { DeliveryNoteItem } from '../entities/delivery-note-item.entity';
import { SalesMailService } from './sales-mail.service';
import { ClientPortalService } from './client-portal.service';
import { CreateSalesOrderDto } from '../dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from '../dto/update-sales-order.dto';
import { StockMovementsService } from '../../stock/services/stock-movements/stock-movements.service';
import { StockMovementType } from '../../stock/enums/stock-movement-type.enum';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { Product, ProductType } from '../../stock/entities/product.entity';

const TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.IN_PROGRESS, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.IN_PROGRESS]: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.DELIVERED]: [SalesOrderStatus.INVOICED],
  [SalesOrderStatus.INVOICED]: [],
  [SalesOrderStatus.CANCELLED]: [],
};

@Injectable()
export class SalesOrdersService {
  private readonly logger = new Logger(SalesOrdersService.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,

    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,

    @InjectRepository(DeliveryNote)
    private readonly deliveryNoteRepo: Repository<DeliveryNote>,

    @InjectRepository(DeliveryNoteItem)
    private readonly deliveryNoteItemRepo: Repository<DeliveryNoteItem>,

    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @Inject(forwardRef(() => SalesMailService))
    private readonly mailService: SalesMailService,

    @Inject(forwardRef(() => ClientPortalService))
    private readonly portalService: ClientPortalService,

    private readonly stockMovementsService: StockMovementsService,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, dto: CreateSalesOrderDto): Promise<SalesOrder> {
    // ✅ CRITICAL VALIDATION: Ensure all items have productId
    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      if (!item.productId || item.productId.trim() === '') {
        throw new BadRequestException(
          `Ligne ${i + 1}: Le produit est obligatoire pour le suivi des stocks. ` +
          `Description: "${item.description}". Veuillez sélectionner un produit du catalogue.`
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.generateNumber(businessId, manager);
      const { items: itemsDto, ...rest } = dto;
      const { subtotal, taxAmount, netAmount, items } = this.calcTotals(itemsDto);

      const order = manager.create(SalesOrder, {
        ...rest,
        orderNumber,
        businessId,
        status: SalesOrderStatus.CONFIRMED,
        subtotal,
        taxAmount,
        total: subtotal + taxAmount,
        timbreFiscal: 1.000,
        netAmount,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : null,
      });
      const saved = await manager.save(SalesOrder, order);

      const lines = items.map((item) =>
        manager.create(SalesOrderItem, {
          ...item,
          salesOrderId: saved.id,
        }),
      );
      await manager.save(SalesOrderItem, lines);

      const result = await manager.findOne(SalesOrder, {
        where: { id: saved.id },
        relations: ['items', 'client'],
      }) as SalesOrder;

      // DO NOT create stock movements here - they should be created when order is DELIVERED
      // Stock movements will be created in markDelivered() method

      return result;
    });
  }

  async findAll(businessId: string, query: any) {
    const { client_id, status, page = 1, limit = 20 } = query;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.client', 'client')
      .where('order.businessId = :businessId', { businessId })
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim());
      qb.andWhere('order.status IN (:...statuses)', { statuses });
    }
    if (client_id) qb.andWhere('order.clientId = :client_id', { client_id });

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string): Promise<SalesOrder> {
    const order = await this.orderRepo.findOne({
      where: { id, businessId },
      relations: ['items', 'client'],
    });
    if (!order) throw new NotFoundException(`Commande introuvable (id: ${id})`);
    return order;
  }

  async update(businessId: string, id: string, dto: UpdateSalesOrderDto): Promise<SalesOrder> {
    const order = await this.findOne(businessId, id);

    if (order.status !== SalesOrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Modification impossible. Statut actuel : ${order.status}. Requis : CONFIRMED.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      try {
        if (dto.expectedDelivery !== undefined)
          order.expectedDelivery = dto.expectedDelivery ? new Date(dto.expectedDelivery) : null;
        if (dto.notes !== undefined)
          order.notes = dto.notes;

        if (dto.items?.length) {
          // Reverse stock movements for old items
          try {
            await this.reverseStockMovements(businessId, id, manager);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to reverse stock movements: ${errorMessage}`, errorStack);
            // Continue with update even if reversal fails
          }

          await manager.delete(SalesOrderItem, { salesOrderId: id });

          const { subtotal, taxAmount, netAmount, items } = this.calcTotals(dto.items);
          order.subtotal = subtotal;
          order.taxAmount = taxAmount;
          order.total = subtotal + taxAmount;
          order.netAmount = netAmount;

          await manager.save(SalesOrder, order);

          const lines = items.map((item) =>
            manager.create(SalesOrderItem, {
              ...item,
              salesOrderId: id,
            }),
          );
          await manager.save(SalesOrderItem, lines);

          // Create new stock movements for updated items
          for (const item of lines) {
            if (item.productId) {
              try {
                // ==================== Alaa change for service type ====================
                // Services and digital products do not affect stock — skip movement creation
                const product = await manager.findOne(Product, {
                  where: { id: item.productId },
                });
                if (product && (product.type === ProductType.SERVICE || product.type === ProductType.DIGITAL)) {
                  continue;
                }
                // ====================================================================

                if (product) {
                  const quantityBefore = Number(product.quantity);
                  const quantityChange = -Math.abs(Number(item.quantity)); // Negative for sales
                  const quantityAfter = Number((quantityBefore + quantityChange).toFixed(3));

                  // Create stock movement directly in the transaction
                  const movement = manager.create(StockMovement, {
                    business_id: businessId,
                    product_id: item.productId,
                    type: StockMovementType.SORTIE_VENTE,
                    quantity: quantityChange,
                    quantity_before: quantityBefore,
                    quantity_after: quantityAfter,
                    reference_type: 'SALES_ORDER',
                    reference_id: id,
                    note: `Sortie vente - Commande ${order.orderNumber}`,
                  });
                  await manager.save(StockMovement, movement);

                  // Update product quantity
                  product.quantity = quantityAfter;
                  await manager.save(Product, product);
                }
              } catch (error) {
                this.logger.error(`Failed to create stock movement for product ${item.productId}:`, error);
                // Continue with other items even if one fails
              }
            }
          }
        } else {
          await manager.save(SalesOrder, order);
        }

        const result = await manager.findOne(SalesOrder, {
          where: { id },
          relations: ['items', 'client'],
        });

        if (!result) {
          throw new NotFoundException(`Sales order not found after update`);
        }

        return result;
      } catch (error) {
        this.logger.error(`Failed to update sales order ${id}:`, error);
        throw error;
      }
    });
  }

  async startProgress(businessId: string, id: string) {
    const order = await this.findOne(businessId, id);

    return this.dataSource.transaction(async (manager) => {
      const deliveryNoteNumber = await this.generateDeliveryNoteNumber(businessId, manager);

      const deliveryNote = manager.create(DeliveryNote, {
        businessId,
        clientId: order.clientId,
        salesOrderId: order.id,
        deliveryNoteNumber,
        deliveryDate: new Date(),
        status: 'pending',
        notes: `Bon de livraison pour commande ${order.orderNumber}`,
      });

      const savedDeliveryNote = await manager.save(DeliveryNote, deliveryNote);

      const deliveryNoteItems = order.items.map((item) => {
        // Validate that productId is present
        if (!item.productId) {
          throw new Error(`Product ID is required for item: ${item.description}`);
        }
        
        return manager.create(DeliveryNoteItem, {
          deliveryNoteId: savedDeliveryNote.id,
          productId: item.productId, // CRITICAL: Include productId from sales order item
          description: item.description,
          quantity: item.quantity,
          deliveredQuantity: 0,
        });
      });

      await manager.save(DeliveryNoteItem, deliveryNoteItems);

      order.status = SalesOrderStatus.IN_PROGRESS;
      await manager.save(SalesOrder, order);

      // DO NOT create stock movements here - they should be created when order is DELIVERED
      // Stock movements will be created in markDelivered() method

      return this.findOne(businessId, id);
    });
  }

  async markDelivered(businessId: string, id: string) {
    const order = await this.findOne(businessId, id);
    
    return this.dataSource.transaction(async (manager) => {
      // Update order status
      order.status = SalesOrderStatus.DELIVERED;
      order.deliveryDate = new Date();
      await manager.save(SalesOrder, order);

      // Create stock movements for each item with productId when order is DELIVERED
      for (const item of order.items) {
        if (item.productId) {
          try {
            // Check if product is physical (not service or digital)
            const product = await manager.findOne(Product, {
              where: { id: item.productId },
            });
            
            if (product && (product.type === ProductType.SERVICE || product.type === ProductType.DIGITAL)) {
              this.logger.log(`Skipping stock movement for service/digital product ${item.productId}`);
              continue;
            }

            if (product) {
              const quantityBefore = Number(product.quantity);
              const quantityChange = -Math.abs(Number(item.quantity)); // Negative for sales
              const quantityAfter = Number((quantityBefore + quantityChange).toFixed(3));

              // Create stock movement
              const movement = manager.create(StockMovement, {
                business_id: businessId,
                product_id: item.productId,
                type: StockMovementType.SORTIE_VENTE,
                quantity: quantityChange,
                quantity_before: quantityBefore,
                quantity_after: quantityAfter,
                reference_type: 'SALES_ORDER',
                reference_id: order.id,
                note: `Sortie vente - Commande ${order.orderNumber} livrée`,
              });
              await manager.save(StockMovement, movement);

              // Update product quantity
              product.quantity = quantityAfter;
              await manager.save(Product, product);
              
              this.logger.log(`Stock movement created for product ${item.productId}: ${quantityBefore} -> ${quantityAfter}`);
            }
          } catch (error) {
            this.logger.error(`Failed to create stock movement for product ${item.productId}:`, error);
            // Continue with other items even if one fails
          }
        }
      }

      return this.findOne(businessId, id);
    });
  }

  async markInvoiced(businessId: string, id: string) {
    return this.transition(businessId, id, SalesOrderStatus.INVOICED);
  }

  async cancel(businessId: string, id: string) {
    return this.transition(businessId, id, SalesOrderStatus.CANCELLED);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const order = await this.findOne(businessId, id);

    if (order.status !== SalesOrderStatus.CONFIRMED && order.status !== SalesOrderStatus.INVOICED) {
      throw new BadRequestException(
        `Suppression impossible. Seules les commandes confirmées (CONFIRMED) ou facturées (INVOICED) peuvent être supprimées. Statut actuel : ${order.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (order.status === SalesOrderStatus.INVOICED) {
        await manager.query(
          `UPDATE invoices SET sales_order_id = NULL WHERE sales_order_id = $1`,
          [id],
        );
      }

      // Reverse stock movements before deleting
      await this.reverseStockMovements(businessId, id, manager);

      await manager.delete(SalesOrderItem, { salesOrderId: id });
      await manager.delete(SalesOrder, { id, businessId });
    });
  }

  /**
   * Helper method to reverse stock movements for a sales order
   */
  private async reverseStockMovements(
    businessId: string,
    salesOrderId: string,
    manager: any,
  ): Promise<void> {
    // Find all stock movements for this sales order
    const movements = await manager.find(StockMovement, {
      where: {
        business_id: businessId,
        reference_type: 'SALES_ORDER',
        reference_id: salesOrderId,
      },
    });

    this.logger.log(`Found ${movements.length} stock movements to reverse for sales order ${salesOrderId}`);

    // Reverse each movement by updating product quantities
    for (const movement of movements) {
      try {
        const product = await manager.findOne(Product, {
          where: { id: movement.product_id },
        });

        if (product) {
          // Reverse the quantity change
          // If movement.quantity is negative (SORTIE), subtracting it will add back to stock
          // If movement.quantity is positive (ENTREE), subtracting it will remove from stock
          const newQuantity = Number(product.quantity) - Number(movement.quantity);
          this.logger.log(`Reversing movement for product ${product.id}: ${product.quantity} - ${movement.quantity} = ${newQuantity}`);
          
          product.quantity = newQuantity;
          await manager.save(Product, product);
        } else {
          this.logger.warn(`Product ${movement.product_id} not found for movement ${movement.id}`);
        }

        // Delete the movement record
        await manager.remove(StockMovement, movement);
      } catch (error) {
        this.logger.error(`Failed to reverse stock movement ${movement.id}:`, error);
        // Don't throw - continue with other movements
      }
    }
  }

  private async transition(
    businessId: string,
    id: string,
    target: SalesOrderStatus,
    mutate?: (order: SalesOrder) => void,
  ): Promise<SalesOrder> {
    const order = await this.findOne(businessId, id);
    const allowed = TRANSITIONS[order.status];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition invalide : ${order.status} → ${target}. ` +
          `Autorisées : ${allowed.join(', ') || 'aucune (statut terminal)'}`,
      );
    }

    order.status = target;
    if (mutate) mutate(order);
    await this.orderRepo.save(order);
    return this.findOne(businessId, id);
  }

  private calcTotals(itemsDto: CreateSalesOrderDto['items']) {
    let subtotal = 0;
    let taxAmount = 0;

    const items = itemsDto.map((item) => {
      const total = this.round(item.quantity * item.unitPrice);
      const itemTax = this.round(total * (item.taxRate / 100));
      subtotal += total;
      taxAmount += itemTax;
      return { ...item, total };
    });

    subtotal = this.round(subtotal);
    taxAmount = this.round(taxAmount);
    const netAmount = this.round(subtotal + taxAmount + 1.000);
    return { subtotal, taxAmount, netAmount, items };
  }

  private async generateNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CMD-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING("orderNumber" FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM sales_orders
      WHERE "businessId" = $1
        AND "orderNumber" LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private async generateInvoiceNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING(invoice_number FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM invoices
      WHERE business_id = $1
        AND invoice_number LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(5, '0');
    return `${prefix}${seq}`;
  }

  private async generateDeliveryNoteNumber(businessId: string, manager: any): Promise<string> {
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
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }

  private calculateDueDate(date: Date, days: number): Date {
    const due = new Date(date);
    due.setDate(due.getDate() + days);
    return due;
  }

  private getLogoBase64(): string {
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      this.logger.log(`Tentative de chargement du logo depuis: ${logoPath}`);
      
      if (!fs.existsSync(logoPath)) {
        this.logger.warn(`Logo non trouvé à: ${logoPath}`);
        return '';
      }
      
      const logoBuffer = fs.readFileSync(logoPath);
      const base64Logo = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      this.logger.log(`Logo chargé avec succès, taille: ${logoBuffer.length} bytes`);
      return base64Logo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erreur lors du chargement du logo: ${errorMessage}`);
      return '';
    }
  }

  async convertToInvoice(businessId: string, id: string): Promise<Invoice> {
    const order = await this.findOne(businessId, id);

    if (order.status !== SalesOrderStatus.DELIVERED) {
      throw new BadRequestException(
        `La commande doit être livrée avant conversion. Statut actuel : ${order.status}`,
      );
    }

    if (order.invoiceId) {
      throw new BadRequestException(
        `Cette commande a déjà été convertie en facture (ID: ${order.invoiceId})`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(businessId, manager);

      const invoice = manager.create(Invoice, {
        business_id: businessId,
        client_id: order.clientId,
        invoice_number: invoiceNumber,
        type: 'NORMAL' as any,
        status: InvoiceStatus.DRAFT,
        date: new Date(),
        due_date: this.calculateDueDate(new Date(), 30),
        sales_order_id: order.id,
        subtotal_ht: Number(order.subtotal),
        tax_amount: Number(order.taxAmount),
        timbre_fiscal: Number(order.timbreFiscal),
        total_ttc: Number(order.total) + Number(order.timbreFiscal),
        net_amount: Number(order.netAmount),
        paid_amount: 0,
        notes: order.notes,
      });

      const savedInvoice = await manager.save(Invoice, invoice);

      const invoiceItems = order.items.map((item) => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        const lineTax = lineTotal * (Number(item.taxRate) / 100);
        const lineTotalTtc = lineTotal + lineTax;

        return manager.create(InvoiceItem, {
          invoice_id: savedInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate_value: item.taxRate,
          line_total_ht: lineTotal,
          line_tax: lineTax,
          line_total_ttc: lineTotalTtc,
          sort_order: 0,
        });
      });

      await manager.save(InvoiceItem, invoiceItems);

      order.status = SalesOrderStatus.INVOICED;
      order.invoiceId = savedInvoice.id;
      await manager.save(SalesOrder, order);

      return manager.findOne(Invoice, {
        where: { id: savedInvoice.id },
        relations: ['items', 'client'],
      }) as Promise<Invoice>;
    });
  }

  async sendOrderConfirmationEmail(businessId: string, id: string): Promise<{ message: string }> {
    const order = await this.orderRepo.findOne({
      where: { id, businessId },
      relations: ['items', 'client', 'business'],
    });

    if (!order) throw new NotFoundException(`Commande introuvable (id: ${id})`);

    if (!order.client?.email) {
      throw new BadRequestException("Le client n'a pas d'adresse email");
    }

    const portalToken = await this.portalService.generatePortalToken(
      businessId,
      order.clientId,
      order.id,
    );

    try {
      await this.sendEmailWithPortal(order, order.client.email, portalToken);
      return { message: `Email de confirmation envoyé à ${order.client.email}` };
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new BadRequestException(`Erreur lors de l'envoi de l'email: ${errorMessage}`);
    }
  }

  private async sendEmailWithPortal(
    order: any,
    recipientEmail: string,
    portalToken: string,
  ): Promise<void> {
    const nodemailer = require('nodemailer');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const portalUrl = `${frontendUrl}/client-portal?token=${portalToken}`;

    const businessName = order.business?.name || 'Votre Entreprise';
    const businessEmail = order.business?.email || process.env.GMAIL_USER || 'novaentra2026@gmail.com';
    const businessPhone = order.business?.phone || '';
    const businessMF = order.business?.tax_id || '';

    const orderDate = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const itemsHtml = (order.items ?? [])
      .map((item: any, index: number) => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        const lineTax = lineTotal * (Number(item.taxRate) / 100);
        const lineTotalTtc = lineTotal + lineTax;
        return `
          <tr style="background:${index % 2 === 0 ? '#ffffff' : '#F8F9FF'};">
            <td style="padding:11px 14px;font-size:13px;color:#374151;border-bottom:1px solid #E5E7EB;">${index + 1}</td>
            <td style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #E5E7EB;">${item.description}</td>
            <td style="padding:11px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${Number(item.quantity).toFixed(3)}</td>
            <td style="padding:11px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${Number(item.unitPrice).toFixed(3)} TND</td>
            <td style="padding:11px 14px;font-size:13px;text-align:center;border-bottom:1px solid #E5E7EB;">
              <span style="background:#EEF2FF;color:#4F46E5;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${Number(item.taxRate)}%</span>
            </td>
            <td style="padding:11px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${lineTotal.toFixed(3)} TND</td>
            <td style="padding:11px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${lineTax.toFixed(3)} TND</td>
            <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111827;text-align:right;border-bottom:1px solid #E5E7EB;">${lineTotalTtc.toFixed(3)} TND</td>
          </tr>`;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande ${order.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:28px 16px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#1a1a3e;border-radius:12px 12px 0 0;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="cid:company-logo" alt="${businessName}" height="44"
                          style="display:block;height:44px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />
                    <p style="margin:6px 0 0;font-size:14px;font-weight:600;color:rgba(255,255,255,0.7);">${businessName}</p>
                  </td>
                  <td style="text-align:right;vertical-align:middle;">
                    <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Commande Client</p>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${order.orderNumber}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.5);">Émis le ${orderDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INDIGO ACCENT BAR -->
          <tr>
            <td style="background:#4F46E5;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- BUSINESS INFO BAR -->
          <tr>
            <td style="background:#ffffff;padding:12px 36px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#6B7280;">
                    ${businessEmail ? `<span style="margin-right:20px;">✉ ${businessEmail}</span>` : ''}
                    ${businessPhone ? `<span style="margin-right:20px;">📞 ${businessPhone}</span>` : ''}
                    ${businessMF ? `<span>🏛 MF: ${businessMF}</span>` : ''}
                  </td>
                  <td style="text-align:right;">
                    <span style="background:#EEF2FF;color:#4F46E5;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.3px;">Confirmée</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:32px 36px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">
                Bonjour, <span style="color:#4F46E5;">${order.client?.name}</span> 👋
              </p>
              <p style="margin:0 0 28px;font-size:13px;color:#6B7280;line-height:1.75;">
                Nous avons le plaisir de vous soumettre votre commande
                <strong style="color:#111827;">${order.orderNumber}</strong>.
                Merci de bien vouloir la confirmer ou la refuser via votre portail client sécurisé.
              </p>

              <!-- Client / Fournisseur cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48%" style="vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                      style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
                      <tr>
                        <td style="background:#F9FAFB;padding:8px 16px;border-bottom:1px solid #E5E7EB;">
                          <p style="margin:0;font-size:10px;font-weight:700;color:#4F46E5;text-transform:uppercase;letter-spacing:1px;">Client</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${order.client?.name || ''}</p>
                          ${order.client?.address ? `<p style="margin:0 0 2px;font-size:12px;color:#6B7280;">${order.client.address}</p>` : ''}
                          ${order.client?.email ? `<p style="margin:0 0 2px;font-size:12px;color:#6B7280;">Email : ${order.client.email}</p>` : ''}
                          ${order.client?.phone ? `<p style="margin:0;font-size:12px;color:#6B7280;">Tél : ${order.client.phone}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                      style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
                      <tr>
                        <td style="background:#F9FAFB;padding:8px 16px;border-bottom:1px solid #E5E7EB;">
                          <p style="margin:0;font-size:10px;font-weight:700;color:#4F46E5;text-transform:uppercase;letter-spacing:1px;">Fournisseur</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${businessName}</p>
                          <p style="margin:0 0 2px;font-size:12px;color:#6B7280;">N° Commande : ${order.orderNumber}</p>
                          <p style="margin:0;font-size:12px;color:#6B7280;">Date : ${orderDate}</p>
                          ${businessMF ? `<p style="margin:2px 0 0;font-size:12px;color:#6B7280;">MF : ${businessMF}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section title -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td style="border-left:4px solid #4F46E5;padding-left:10px;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Détail de la commande</p>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:#1a1a3e;">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">#</th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Qté</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Prix unitaire</th>
                    <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">TVA</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Total HT</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">TVA</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Totals -->
              <table cellpadding="0" cellspacing="0"
                style="margin-left:auto;min-width:320px;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:32px;">
                <tr style="background:#F9FAFB;">
                  <td style="padding:10px 20px;font-size:13px;color:#6B7280;">Sous-total HT</td>
                  <td style="padding:10px 20px;text-align:right;font-size:13px;color:#111827;font-weight:600;">${Number(order.subtotal).toFixed(3)} TND</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;font-size:13px;color:#6B7280;">TVA</td>
                  <td style="padding:10px 20px;text-align:right;font-size:13px;color:#111827;font-weight:600;">${Number(order.taxAmount).toFixed(3)} TND</td>
                </tr>
                <tr style="background:#F9FAFB;">
                  <td style="padding:10px 20px;font-size:13px;color:#6B7280;">Timbre fiscal</td>
                  <td style="padding:10px 20px;text-align:right;font-size:13px;color:#111827;font-weight:600;">1,000 TND</td>
                </tr>
                <tr style="background:#4F46E5;">
                  <td style="padding:14px 20px;font-size:14px;font-weight:800;color:#ffffff;">NET À PAYER TTC</td>
                  <td style="padding:14px 20px;text-align:right;font-size:14px;font-weight:800;color:#ffffff;">${Number(order.netAmount).toFixed(3)} TND</td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#F8F9FF;border:1px solid #E0E7FF;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827;">Votre réponse est attendue</p>
                    <p style="margin:0 0 22px;font-size:13px;color:#6B7280;line-height:1.6;">
                      Confirmez ou refusez cette commande directement depuis votre portail client sécurisé.
                    </p>
                    <a href="${portalUrl}"
                      style="display:inline-block;padding:13px 36px;background:#4F46E5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      Accéder à mon portail client →
                    </a>
                    <p style="margin:14px 0 0;font-size:11px;color:#9CA3AF;">🔒 Lien sécurisé — valable 72 heures</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1a1a3e;padding:20px 36px;border-radius:0 0 12px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;font-weight:600;color:#ffffff;">${businessName}</td>
                  <td style="text-align:right;font-size:11px;color:rgba(255,255,255,0.4);">
                    Cet email a été envoyé automatiquement — merci de ne pas y répondre directement.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'novaentra2026@gmail.com',
        pass: process.env.GMAIL_PASS || 'enrqztjhkqbryrar',
      },
    });

    const attachments: any[] = [
      {
        filename: 'logo.png',
        path: path.join(process.cwd(), 'public', 'logo.png'),
        cid: 'company-logo',
      },
    ];

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.GMAIL_USER || 'novaentra2026@gmail.com'}>`,
      to: recipientEmail,
      subject: `🧾 Commande ${order.orderNumber} — Confirmation requise`,
      html,
      attachments,
    });
  }
}
