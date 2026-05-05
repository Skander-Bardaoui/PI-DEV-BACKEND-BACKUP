// src/Purchases/services/supplier-pos.service.ts
//hedi s7i7a

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SupplierPO }     from '../entities/supplier-po.entity';
import { SupplierPOItem } from '../entities/supplier-po-item.entity';
import { POStatus }       from '../enum/po-status.enum';
import { SuppliersService }    from '../services/suppliers.service';
import { PurchaseMailService } from '../services/purchase-mail.service';
import { CreateSupplierPODto } from '../dto/create-supplier-po.dto';
import { UpdateSupplierPODto } from '../dto/update-supplier-po.dto';
import { StockMovementsService } from '../../stock/services/stock-movements/stock-movements.service';
import { StockMovementType } from '../../stock/enums/stock-movement-type.enum';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { Product, ProductType } from '../../stock/entities/product.entity';
import { MlPredictionService } from './ml-prediction.service';

const TRANSITIONS: Record<POStatus, POStatus[]> = {
  [POStatus.DRAFT]:              [POStatus.SENT, POStatus.CANCELLED],
  [POStatus.SENT]:               [POStatus.CONFIRMED, POStatus.CANCELLED],
  [POStatus.CONFIRMED]:          [POStatus.PARTIALLY_RECEIVED, POStatus.FULLY_RECEIVED, POStatus.CANCELLED],
  [POStatus.PARTIALLY_RECEIVED]: [POStatus.FULLY_RECEIVED],
  [POStatus.FULLY_RECEIVED]:     [],
  [POStatus.CANCELLED]:          [],
};

@Injectable()
export class SupplierPOsService {
  private readonly logger = new Logger(SupplierPOsService.name);

  constructor(
    @InjectRepository(SupplierPO)
    private readonly poRepo: Repository<SupplierPO>,

    @InjectRepository(SupplierPOItem)
    private readonly itemRepo: Repository<SupplierPOItem>,

    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly suppliersService: SuppliersService,
    private readonly mlPredictionService: MlPredictionService,
    private readonly dataSource: DataSource,
    private readonly purchaseMailService: PurchaseMailService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  async create(businessId: string, dto: CreateSupplierPODto): Promise<SupplierPO> {
    await this.suppliersService.findOneOrFail(businessId, dto.supplier_id);

    // Debug log
    this.logger.debug(`Creating PO with DTO: ${JSON.stringify(dto)}`);
    this.logger.debug(`Items received: ${dto.items ? dto.items.length : 'undefined'}`);
    this.logger.debug(`ML Product ID: ${dto.ml_product_id || 'none'}`);
    
    // Log each item's product_id
    dto.items?.forEach((item, idx) => {
      this.logger.debug(`Item ${idx}: product_id=${item.product_id || 'NULL'}, description="${item.description}"`);
    });
    
    // ⚠️ VALIDATION: Warn if items don't have product_id (stock won't be tracked)
    const itemsWithoutProduct = dto.items.filter(item => !item.product_id);
    if (itemsWithoutProduct.length > 0) {
      this.logger.warn(
        `⚠️ ${itemsWithoutProduct.length} item(s) without product_id. Stock movements will NOT be created for these items. ` +
        `To track inventory, please select products from the catalog when creating purchase orders.`
      );
    }

    const ml_product_id = dto.ml_product_id; // Sauvegarder avant la transaction

    const result = await this.dataSource.transaction(async (manager) => {
      const po_number = await this.generateNumber(businessId, manager);
      const { items: itemsDto, ml_product_id: _, ...rest } = dto;
      const { subtotal_ht, tax_amount, net_amount, items } = this.calcTotals(itemsDto);

      const po = manager.create(SupplierPO, {
        ...rest,
        po_number,
        business_id:   businessId,
        status:        POStatus.DRAFT,
        subtotal_ht,
        tax_amount,
        timbre_fiscal: 1.000,
        net_amount,
      });
      const saved = await manager.save(SupplierPO, po);

      const lines = items.map((item, i) => {
        // Validate that product_id is present
        if (!item.product_id) {
          throw new Error(`Product ID is required for item: ${item.description}`);
        }
        
        const poItem = manager.create(SupplierPOItem, {
          supplier_po_id: saved.id,
          product_id: item.product_id, // Required field
          description: item.description,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit_price_ht: item.unit_price_ht,
          tax_rate_value: item.tax_rate_value,
          line_total_ht: item.line_total_ht,
          line_tax: item.line_tax,
          sort_order: item.sort_order ?? i,
        });
        
        this.logger.debug(`Creating PO item ${i}: product_id=${poItem.product_id}, desc="${poItem.description}"`);
        return poItem;
      });
      
      await manager.save(SupplierPOItem, lines);

      return manager.findOne(SupplierPO, {
        where: { id: saved.id },
        relations: ['items', 'supplier'],
      }) as Promise<SupplierPO>;
    });

    // Marquer comme traité APRÈS la transaction (quand le BC existe vraiment)
    if (ml_product_id && result) {
      try {
        this.logger.log(`🤖 Marquage ML pour produit ${ml_product_id}, BC ${result.id}`);
        await this.mlPredictionService.markAsProcessed(
          businessId,
          ml_product_id,
          result.id,
        );
        this.logger.log(`✅ Recommandation ML marquée comme traitée`);
      } catch (error: any) {
        this.logger.error(`❌ Erreur lors du marquage ML: ${error?.message || error}`);
        // Ne pas bloquer la création du BC si le marquage échoue
      }
    }

    return result;
  }

  async findAll(businessId: string, query: any) {
    const { supplier_id, status, date_from, date_to, page = 1, limit = 20 } = query;

    const qb = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .where('po.business_id = :businessId', { businessId })
      .orderBy('po.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim());
      qb.andWhere('po.status IN (:...statuses)', { statuses });
    }
    if (supplier_id) qb.andWhere('po.supplier_id = :supplier_id', { supplier_id });
    if (date_from)   qb.andWhere('po.created_at >= :date_from', { date_from });
    if (date_to)     qb.andWhere('po.created_at <= :date_to', { date_to });

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string): Promise<SupplierPO> {
    const po = await this.poRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['items', 'supplier'],
    });
    if (!po) throw new NotFoundException(`BC introuvable (id: ${id})`);
    return po;
  }

  async update(businessId: string, id: string, dto: UpdateSupplierPODto): Promise<SupplierPO> {
    this.logger.log(`🔍 UPDATE START: PO id=${id}`);
    this.logger.log(`🔍 DTO received: ${JSON.stringify(dto, null, 2)}`);
    
    try {
      const po = await this.findOne(businessId, id);
      this.logger.log(`🔍 Current PO has ${po.items?.length || 0} items BEFORE update`);

      if (po.status !== POStatus.DRAFT) {
        throw new BadRequestException(
          `Modification impossible. Statut actuel : ${po.status}. Requis : DRAFT.`,
        );
      }

      // Update PO fields
      if (dto.expected_delivery !== undefined) {
        po.expected_delivery = dto.expected_delivery && dto.expected_delivery.trim() !== '' 
          ? new Date(dto.expected_delivery) 
          : null;
      }
      if (dto.notes !== undefined) {
        po.notes = dto.notes;
      }

      if (dto.items?.length) {
        this.logger.log(`🔍 DTO contains ${dto.items.length} items to save`);
        
        // Calculate totals
        const { subtotal_ht, tax_amount, net_amount, items } = this.calcTotals(dto.items);
        po.subtotal_ht = subtotal_ht;
        po.tax_amount  = tax_amount;
        po.net_amount  = net_amount;

        // Delete existing items using repository delete method
        this.logger.log(`🔍 Deleting existing items for PO ${id}`);
        try {
          const deleteResult = await this.itemRepo.delete({ supplier_po_id: id });
          this.logger.log(`🔍 Items deleted, affected: ${deleteResult.affected}`);
        } catch (deleteError) {
          this.logger.error(`❌ Error deleting items:`, deleteError);
          throw deleteError;
        }

        // Create new items
        const newItems = items.map((item, i) => {
          // Validate that product_id is present
          if (!item.product_id) {
            throw new Error(`Product ID is required for item: ${item.description}`);
          }
          
          const itemEntity = this.itemRepo.create({
            supplier_po_id: id,
            product_id: item.product_id, // Required field
            description: item.description,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
            unit_price_ht: item.unit_price_ht,
            tax_rate_value: item.tax_rate_value,
            line_total_ht: item.line_total_ht,
            line_tax: item.line_tax,
            sort_order: item.sort_order ?? i,
          });
          
          this.logger.log(`🔍   Creating new item ${i}: product_id=${itemEntity.product_id}, desc="${itemEntity.description}", qty=${itemEntity.quantity_ordered}`);
          return itemEntity;
        });

        this.logger.log(`🔍 Saving ${newItems.length} new items`);
        try {
          await this.itemRepo.save(newItems);
          this.logger.log(`🔍 Items saved successfully`);
        } catch (saveError) {
          this.logger.error(`❌ Error saving items:`, saveError);
          throw saveError;
        }
      }

      // Save the PO
      this.logger.log(`🔍 Saving PO`);
      try {
        await this.poRepo.save(po);
        this.logger.log(`🔍 PO saved successfully`);
      } catch (saveError) {
        this.logger.error(`❌ Error saving PO:`, saveError);
        throw saveError;
      }
      
      // Fetch fresh data to confirm
      this.logger.log(`🔍 Fetching updated PO with relations`);
      const result = await this.poRepo.findOne({
        where: { id, business_id: businessId },
        relations: ['items', 'supplier'],
      });
      
      if (!result) {
        this.logger.error(`❌ Could not find PO after update`);
        throw new NotFoundException(`BC introuvable après mise à jour (id: ${id})`);
      }
      
      this.logger.log(`🔍 UPDATE COMPLETE: Returning PO with ${result.items?.length || 0} items`);
      result.items?.forEach((item, idx) => {
        this.logger.log(`🔍   Final Item ${idx}: id=${item.id}, desc="${item.description}", qty=${item.quantity_ordered}`);
      });
      
      return result;
    } catch (error) {
      this.logger.error(`❌ UPDATE FAILED:`, error);
      throw error;
    }
  }

async send(businessId: string, id: string) {
  const po = await this.transition(businessId, id, POStatus.SENT, (p) => {
    p.sent_at = new Date();
  });

  // ANOMALIE 3 FIX: Suppression des console.log en production + gestion d'erreur améliorée
  const poWithRelations = await this.poRepo.findOne({
    where:     { id },
    relations: ['items', 'supplier'],
  });

  if (poWithRelations && poWithRelations.supplier?.email) {
    this.purchaseMailService.sendPurchaseOrder(poWithRelations).catch((err) => {
      // Logger l'erreur au lieu de console.log
      this.logger.error(`Échec envoi email BC ${po.po_number}: ${err.message}`);
    });
  } else if (poWithRelations && !poWithRelations.supplier?.email) {
    this.logger.warn(`BC ${po.po_number}: fournisseur sans email, envoi impossible`);
  }

  return po;
}

  async confirm(businessId: string, id: string) {
    return this.transition(businessId, id, POStatus.CONFIRMED);
  }

  async cancel(businessId: string, id: string) {
    const po = await this.findOne(businessId, id);
    
    // Validation: annulation possible uniquement pour DRAFT ou SENT
    if (![POStatus.DRAFT, POStatus.SENT].includes(po.status)) {
      throw new BadRequestException(
        `Annulation impossible : le BC doit être en statut "Brouillon" ou "Envoyé". Statut actuel : ${po.status}`,
      );
    }

    // Si le BC était envoyé, envoyer un email d'annulation au fournisseur
    if (po.status === POStatus.SENT && po.supplier?.email) {
      try {
        await this.purchaseMailService.sendCancellationEmail(po);
        this.logger.log(`✅ Email d'annulation envoyé au fournisseur ${po.supplier.name} (${po.supplier.email})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.error(`❌ Erreur lors de l'envoi de l'email d'annulation: ${errorMessage}`);
        // On continue l'annulation même si l'email échoue
      }
    }

    return this.transition(businessId, id, POStatus.CANCELLED);
  }

  async updateStatusAfterReceipt(
    businessId: string,
    poId: string,
    manager: any,
  ): Promise<void> {
    const po = await manager.findOne(SupplierPO, {
      where: { id: poId, business_id: businessId },
      relations: ['items'],
    });
    if (!po) return;

    const allReceived = po.items.every(
      (item: SupplierPOItem) =>
        Number(item.quantity_received) >= Number(item.quantity_ordered),
    );
    const anyReceived = po.items.some(
      (item: SupplierPOItem) => Number(item.quantity_received) > 0,
    );

    if (allReceived)      po.status = POStatus.FULLY_RECEIVED;
    else if (anyReceived) po.status = POStatus.PARTIALLY_RECEIVED;

    await manager.save(SupplierPO, po);

    // NOTE: Stock movements are created in goods-receipts.service.ts, not here
    // This prevents duplicate stock movements
  }

  /**
   * Helper method to create stock movements for received items
   * 
   * NOTE: This method is NO LONGER USED to prevent duplicate stock movements.
   * Stock movements are now created ONLY in goods-receipts.service.ts
   * when a goods receipt is created.
   * 
   * Keeping this method commented for reference in case we need to understand
   * the old logic, but it should NOT be called anywhere.
   */
  /*
  private async createStockMovementsForReceivedItems(
    businessId: string,
    po: SupplierPO,
    manager: any,
  ): Promise<void> {
    // Get existing stock movements for this PO grouped by product
    const existingMovements = await manager
      .createQueryBuilder(StockMovement, 'sm')
      .where('sm.business_id = :businessId', { businessId })
      .andWhere('sm.reference_type = :refType', { refType: 'SUPPLIER_PO' })
      .andWhere('sm.reference_id = :refId', { refId: po.id })
      .getMany();

    // Map product_id -> total quantity already added to stock
    const existingMovementsByProduct = new Map<string, number>();
    for (const movement of existingMovements) {
      const existing = existingMovementsByProduct.get(movement.product_id) || 0;
      existingMovementsByProduct.set(
        movement.product_id,
        existing + Number(movement.quantity)
      );
    }

    // Create stock movements for items with received quantities
    for (const item of po.items) {
      if (!item.product_id) {
        this.logger.debug(`PO item ${item.id} has no product_id, skipping stock movement`);
        continue;
      }

      // ==================== Alaa change for service type ====================
      // Services and digital products do not affect stock — skip movement creation
      const product = await this.productRepo.findOne({
        where: { id: item.product_id },
      });
      if (product && (product.type === ProductType.SERVICE || product.type === ProductType.DIGITAL)) {
        this.logger.debug(`Product ${item.product_id} is a service or digital product, skipping stock movement`);
        continue;
      }
      // ====================================================================

      const receivedQty = Number(item.quantity_received);
      if (receivedQty <= 0) continue;

      // Check how much we already added to stock for this product
      const existingQty = existingMovementsByProduct.get(item.product_id) || 0;
      const qtyToAdd = receivedQty - existingQty;

      if (qtyToAdd <= 0) {
        this.logger.debug(
          `No new quantity to add for product ${item.product_id} (received: ${receivedQty}, already in stock: ${existingQty})`
        );
        continue;
      }

      try {
        await this.stockMovementsService.createManual(businessId, {
          product_id: item.product_id,
          type: StockMovementType.ENTREE_ACHAT,
          quantity: qtyToAdd,
          source_type: 'SUPPLIER_PO',
          source_id: po.id,
          note: `Entrée achat - BC ${po.po_number} - ${item.description}`,
        });

        this.logger.log(
          `Stock movement created for product ${item.product_id}: +${qtyToAdd} (BC ${po.po_number})`
        );
      } catch (error) {
        this.logger.error(
          `Failed to create stock movement for product ${item.product_id} in PO ${po.po_number}:`,
          error
        );
      }
    }
  }
  */

  private async transition(
    businessId: string,
    id: string,
    target: POStatus,
    mutate?: (po: SupplierPO) => void,
  ): Promise<SupplierPO> {
    const po = await this.findOne(businessId, id);
    const allowed = TRANSITIONS[po.status];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition invalide : ${po.status} → ${target}. ` +
        `Autorisées : ${allowed.join(', ') || 'aucune (statut terminal)'}`,
      );
    }

    po.status = target;
    if (mutate) mutate(po);
    await this.poRepo.save(po);
    return this.findOne(businessId, id);
  }

  private calcTotals(itemsDto: CreateSupplierPODto['items']) {
    if (!itemsDto || !Array.isArray(itemsDto)) {
      throw new Error('Items array is required and must be an array');
    }

    let subtotal_ht = 0;
    let tax_amount  = 0;

    const items = itemsDto.map((item) => {
      const line_total_ht = this.round(item.quantity_ordered * item.unit_price_ht);
      const line_tax      = this.round(line_total_ht * (item.tax_rate_value / 100));
      subtotal_ht += line_total_ht;
      tax_amount  += line_tax;
      return { ...item, line_total_ht, line_tax };
    });

    subtotal_ht  = this.round(subtotal_ht);
    tax_amount   = this.round(tax_amount);
    const net_amount = this.round(subtotal_ht + tax_amount + 1.000);
    return { subtotal_ht, tax_amount, net_amount, items };
  }

  // FIX BUG 4: generateNumber utilise MAX(CAST(...)) au lieu de getCount()
  // Raison : deux transactions simultanées appelant getCount() obtiennent le même résultat
  // → deux BCs avec le même numéro → violation de contrainte UNIQUE.
  // MAX() à l'intérieur d'une transaction sérializée évite ce problème.
  private async generateNumber(businessId: string, manager: any): Promise<string> {
    const year   = new Date().getFullYear();
    const prefix = `ACH-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING(po_number FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM supplier_pos
      WHERE business_id = $1
        AND po_number LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}