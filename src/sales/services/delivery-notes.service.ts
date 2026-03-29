import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DeliveryNote } from '../entities/delivery-note.entity';
import { DeliveryNoteItem } from '../entities/delivery-note-item.entity';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { CreateDeliveryNoteDto } from '../dto/create-delivery-note.dto';
import { UpdateDeliveryNoteDto } from '../dto/update-delivery-note.dto';

@Injectable()
export class DeliveryNotesService {
  constructor(
    @InjectRepository(DeliveryNote)
    private readonly noteRepo: Repository<DeliveryNote>,

    @InjectRepository(DeliveryNoteItem)
    private readonly itemRepo: Repository<DeliveryNoteItem>,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, dto: CreateDeliveryNoteDto): Promise<DeliveryNote> {
    return this.dataSource.transaction(async (manager) => {
      const deliveryNoteNumber = await this.generateNumber(businessId, manager);
      const { items: itemsDto, ...rest } = dto;

      const note = manager.create(DeliveryNote, {
        ...rest,
        deliveryNoteNumber,
        businessId,
        status: 'pending',
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : new Date(),
      });
      const saved = await manager.save(DeliveryNote, note);

      const lines = itemsDto.map((item) =>
        manager.create(DeliveryNoteItem, {
          ...item,
          deliveryNoteId: saved.id,
        }),
      );
      await manager.save(DeliveryNoteItem, lines);

      return manager.findOne(DeliveryNote, {
        where: { id: saved.id },
        relations: ['items', 'client'],
      }) as Promise<DeliveryNote>;
    });
  }

  async findAll(businessId: string, query: any) {
    const { client_id, status, page = 1, limit = 20 } = query;

    const qb = this.noteRepo
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.client', 'client')
      .where('note.businessId = :businessId', { businessId })
      .orderBy('note.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('note.status = :status', { status });
    if (client_id) qb.andWhere('note.clientId = :client_id', { client_id });

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string): Promise<DeliveryNote> {
    const note = await this.noteRepo.findOne({
      where: { id, businessId },
      relations: ['items', 'client'],
    });
    if (!note) throw new NotFoundException(`Bon de livraison introuvable (id: ${id})`);
    return note;
  }

  async update(businessId: string, id: string, dto: UpdateDeliveryNoteDto): Promise<DeliveryNote> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Load the note WITHOUT relations to avoid TypeORM cascade re-inserting
      //    existing items when we call save() on the parent entity.
      const note = await manager.findOne(DeliveryNote, {
        where: { id, businessId },
      });
      if (!note) throw new NotFoundException(`Bon de livraison introuvable (id: ${id})`);

      // 2. Hard-delete ALL existing items first, before touching the parent.
      await manager.delete(DeliveryNoteItem, { deliveryNoteId: id });

      // 3. Update scalar fields on the parent.
      if (dto.deliveryDate !== undefined) note.deliveryDate = new Date(dto.deliveryDate);
      if (dto.notes !== undefined) note.notes = dto.notes;
      if (dto.status !== undefined) note.status = dto.status;

      // 4. Save the parent (no items relation loaded → no cascade re-insert).
      await manager.save(DeliveryNote, note);

      // 5. Insert the new items from the DTO.
      if (dto.items?.length) {
        const lines = dto.items.map((item) =>
          manager.create(DeliveryNoteItem, {
            ...item,
            deliveryNoteId: id,
          }),
        );
        await manager.save(DeliveryNoteItem, lines);
      }

      // 6. Return fresh entity with relations.
      return manager.findOne(DeliveryNote, {
        where: { id },
        relations: ['items', 'client'],
      }) as Promise<DeliveryNote>;
    });
  }

  private async generateNumber(businessId: string, manager: any): Promise<string> {
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

  async markDelivered(businessId: string, id: string): Promise<DeliveryNote> {
    const note = await this.findOne(businessId, id);

    return this.dataSource.transaction(async (manager) => {
      note.status = 'delivered';
      await manager.save(DeliveryNote, note);

      if (note.salesOrderId) {
        const salesOrder = await manager.findOne(SalesOrder, {
          where: { id: note.salesOrderId, businessId },
        });

        if (salesOrder && salesOrder.status === SalesOrderStatus.IN_PROGRESS) {
          salesOrder.status = SalesOrderStatus.DELIVERED;
          salesOrder.deliveryDate = new Date();
          await manager.save(SalesOrder, salesOrder);
        }
      }

      return this.findOne(businessId, id);
    });
  }

  async cancel(businessId: string, id: string): Promise<DeliveryNote> {
    const note = await this.findOne(businessId, id);
    note.status = 'cancelled';
    await this.noteRepo.save(note);
    return this.findOne(businessId, id);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const note = await this.findOne(businessId, id);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(DeliveryNoteItem, { deliveryNoteId: id });
      await manager.delete(DeliveryNote, { id, businessId });
    });
  }
}