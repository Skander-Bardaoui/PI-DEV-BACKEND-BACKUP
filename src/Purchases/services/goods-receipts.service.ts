  // src/Purchases/services/goods-receipts.service.ts
  import {
    Injectable, NotFoundException, BadRequestException, Logger, Optional,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, DataSource } from 'typeorm';

  import { GoodsReceipt }       from '../entities/goods-receipt.entity';
  import { GoodsReceiptItem }   from '../entities/goods-receipt-item.entity';
  import { SupplierPOItem }     from '../entities/supplier-po-item.entity';
  import { SupplierPOsService } from './supplier-pos.service';
  import { POStatus }           from '../enum/po-status.enum';
  import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
  import { StockMovementsService } from '../../stock/services/stock-movements/stock-movements.service';

  @Injectable()
  export class GoodsReceiptsService {

    private readonly logger = new Logger(GoodsReceiptsService.name);

    constructor(
      @InjectRepository(GoodsReceipt)
      private readonly grRepo: Repository<GoodsReceipt>,

      @InjectRepository(GoodsReceiptItem)
      private readonly grItemRepo: Repository<GoodsReceiptItem>,

      private readonly supplierPOsService: SupplierPOsService,
      private readonly dataSource: DataSource,

      @Optional()
      private readonly stockMovementsService: StockMovementsService,
    ) {}

  async create(
    businessId: string,
    poId: string,
    dto: CreateGoodsReceiptDto,
    userId: string,
  ): Promise<GoodsReceipt> {

    const po = await this.supplierPOsService.findOne(businessId, poId);

    if (![POStatus.CONFIRMED, POStatus.PARTIALLY_RECEIVED].includes(po.status)) {
      throw new BadRequestException(
        `BC en statut "${po.status}" non réceptionnable. ` +
        `Requis : CONFIRMED ou PARTIALLY_RECEIVED.`,
      );
    }

    const supplierId = po.supplier_id;
    if (!supplierId) {
      throw new BadRequestException('BC sans fournisseur associé.');
    }

    const poItems = await this.dataSource
      .getRepository(SupplierPOItem)
      .find({ where: { supplier_po_id: poId } });

    const poItemsMap = new Map(poItems.map(i => [i.id, i]));

    this.validateLines(dto.items, poItemsMap);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {

      // ✅ génération correcte du numéro
      const gr_number = await this.generateNumber(businessId, qr.manager);

      const gr = qr.manager.create(GoodsReceipt, {
        gr_number,
        business_id: businessId,
        supplier_po_id: poId,
        supplier_id: supplierId,
        receipt_date: dto.receipt_date ? new Date(dto.receipt_date) : new Date(),
        notes: dto.notes ?? null,
        received_by: userId,
      });

      const savedGR = await qr.manager.save(GoodsReceipt, gr);

      const grItems: GoodsReceiptItem[] = [];

      for (const line of dto.items) {

        const poItem = poItemsMap.get(line.supplier_po_item_id)!;

        const grItem = qr.manager.create(GoodsReceiptItem, {
          gr_id: savedGR.id,
          supplier_po_item_id: line.supplier_po_item_id,
          product_id: poItem.product_id ?? null,
          quantity_received: line.quantity_received,
          unit_price_ht: poItem.unit_price_ht,
        });

        grItems.push(await qr.manager.save(GoodsReceiptItem, grItem));

        await qr.manager
          .createQueryBuilder()
          .update(SupplierPOItem)
          .set({ quantity_received: () => `quantity_received + ${line.quantity_received}` })
          .where('id = :id', { id: line.supplier_po_item_id })
          .execute();
      }

      await this.supplierPOsService.updateStatusAfterReceipt(businessId, poId, qr.manager);

      await qr.commitTransaction();

    //  await this.updateStock(businessId, grItems, userId);

      return this.findOne(businessId, savedGR.id);

    } catch (err: unknown) {

      await qr.rollbackTransaction();
      this.logger.error('Erreur création BR', err instanceof Error ? err.stack : String(err));
      throw err;

    } finally {
      await qr.release();
    }
  }


    async findAllByPO(businessId: string, poId: string): Promise<GoodsReceipt[]> {
      await this.supplierPOsService.findOne(businessId, poId);
      return this.grRepo.find({
        where:     { supplier_po_id: poId, business_id: businessId },
        relations: ['items'],
        order:     { created_at: 'DESC' },
      });
    }

    async findOne(businessId: string, id: string): Promise<GoodsReceipt> {
      const gr = await this.grRepo.findOne({
        where:     { id, business_id: businessId },
        relations: ['items', 'items.supplier_po_item', 'supplier_po', 'supplier_po.supplier'],
      });
      if (!gr) throw new NotFoundException(`Bon de réception introuvable (id: ${id})`);
      return gr;
    }

    private validateLines(
      lines: CreateGoodsReceiptDto['items'],
      poItemsMap: Map<string, SupplierPOItem>,
    ) {
      for (const line of lines) {
        const poItem = poItemsMap.get(line.supplier_po_item_id);
        if (!poItem) {
          throw new BadRequestException(`Ligne BC introuvable (id: ${line.supplier_po_item_id})`);
        }
        const reliquat = Number(poItem.quantity_ordered) - Number(poItem.quantity_received);
        if (reliquat <= 0) {
          throw new BadRequestException(`"${poItem.description}" est déjà entièrement réceptionné.`);
        }
        if (line.quantity_received > reliquat) {
          throw new BadRequestException(
            `Quantité saisie (${line.quantity_received}) > reliquat (${reliquat}) pour "${poItem.description}".`,
          );
        }
        if (line.quantity_received <= 0) {
          throw new BadRequestException(
            `La quantité reçue doit être > 0 pour "${poItem.description}".`,
          );
        }
      }
    }

    private async generateNumber(businessId: string, manager: any): Promise<string> {
      const year   = new Date().getFullYear();
      const prefix = `BR-${year}-`;
      const result = await manager.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(gr_number FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 AS next_seq
        FROM goods_receipts
        WHERE business_id = $1 AND gr_number LIKE $2`,
        [businessId, `${prefix}%`],
      );
      const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
      return `${prefix}${seq}`;
    }

    /*private async updateStock(
      businessId: string,
      items: GoodsReceiptItem[],
      userId: string,
    ): Promise<void> {
      if (!this.stockMovementsService) {
        this.logger.warn('StockMovementsService non disponible — stock non mis à jour.');
        return;
      }
      
      // ANOMALIE 7 FIX: Implémentation de la mise à jour du stock
      for (const item of items) {
        if (!item.product_id) {
          this.logger.debug(`Ligne BR sans product_id, stock non mis à jour`);
          continue;
        }
        
        try {
          await this.stockMovementsService.createMovement({
            business_id: businessId,
            product_id: item.product_id,
            movement_type: 'IN',
            quantity: Number(item.quantity_received),
            reference_type: 'GOODS_RECEIPT',
            reference_id: item.gr_id,
            notes: `Réception marchandise - BR ${item.gr_id}`,
            created_by: userId,
          });
        } catch (err: any) {
          this.logger.error(`Erreur mise à jour stock produit ${item.product_id}: ${err.message}`);
        }
      }
    }*/
  }