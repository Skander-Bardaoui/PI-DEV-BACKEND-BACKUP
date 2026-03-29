import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateOverdueInvoices() {
    this.logger.log('Checking for overdue invoices...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.invoiceRepo
      .createQueryBuilder()
      .update(Invoice)
      .set({ status: InvoiceStatus.OVERDUE })
      .where('due_date < :today', { today })
      .andWhere('status IN (:...statuses)', {
        statuses: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID],
      })
      .execute();

    this.logger.log(`Updated ${result.affected} invoices to OVERDUE status`);
  }
}
