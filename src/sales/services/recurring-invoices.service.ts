import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringInvoice, RecurringFrequency } from '../entities/recurring-invoice.entity';
import { CreateRecurringInvoiceDto } from '../dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from '../dto/update-recurring-invoice.dto';

@Injectable()
export class RecurringInvoicesService {
  constructor(
    @InjectRepository(RecurringInvoice)
    private readonly repo: Repository<RecurringInvoice>,
  ) {}

  async create(businessId: string, dto: CreateRecurringInvoiceDto) {
    const recurring = this.repo.create({
      ...dto,
      business_id: businessId,
      next_invoice_date: dto.start_date,
    });
    return this.repo.save(recurring);
  }

  async findAll(businessId: string, query: any) {
    const { is_active, page = 1, limit = 20 } = query;

    const qb = this.repo
      .createQueryBuilder('ri')
      .leftJoinAndSelect('ri.client', 'client')
      .where('ri.business_id = :businessId', { businessId })
      .orderBy('ri.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (is_active !== undefined) {
      qb.andWhere('ri.is_active = :is_active', { is_active });
    }

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string) {
    const recurring = await this.repo.findOne({
      where: { id, business_id: businessId },
      relations: ['client'],
    });

    if (!recurring) {
      throw new NotFoundException('Facture récurrente introuvable');
    }

    return recurring;
  }

  async update(businessId: string, id: string, dto: UpdateRecurringInvoiceDto) {
    const recurring = await this.findOne(businessId, id);
    Object.assign(recurring, dto);
    return this.repo.save(recurring);
  }

  async remove(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    await this.repo.remove(recurring);
  }

  async activate(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.is_active = true;
    return this.repo.save(recurring);
  }

  async deactivate(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.is_active = false;
    return this.repo.save(recurring);
  }

  calculateNextDate(currentDate: Date, frequency: RecurringFrequency): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case RecurringFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case RecurringFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case RecurringFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case RecurringFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3);
        break;
      case RecurringFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }
}
