import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { TransactionType } from '../enums/transaction-type.enum';
import { InvoiceStatus } from 'src/sales/entities/invoice.entity';
import { Invoice } from 'src/sales/entities/invoice.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, userId: string, dto: any): Promise<Payment> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Vérifier la facture
      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoice_id, business_id: businessId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      if (
        invoice.status === InvoiceStatus.PAID ||
        invoice.status === InvoiceStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Invoice is already ${invoice.status.toLowerCase()}`,
        );
      }

      // 2. Vérifier le compte
      const account = await manager.findOne(Account, {
        where: { id: dto.account_id, business_id: businessId, is_active: true },
      });
      if (!account) throw new NotFoundException('Account not found or inactive');

      // 3. Vérifier que le montant ne dépasse pas le restant dû
      const remaining = Number(invoice.total_ttc) - Number(invoice.paid_amount);
      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Amount exceeds remaining balance. Remaining: ${remaining}`,
        );
      }

      // 4. Créer le paiement
      const payment = manager.create(Payment, {
        business_id: businessId,
        invoice_id: dto.invoice_id,
        account_id: dto.account_id,
        amount: dto.amount,
        payment_date: dto.payment_date,
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        created_by: userId,
      });
      await manager.save(payment);

      // 5. Mettre à jour le paid_amount de la facture
      const newPaidAmount = Number(invoice.paid_amount) + dto.amount;
      invoice.paid_amount = newPaidAmount;

      // 6. Mettre à jour le statut de la facture
      if (newPaidAmount >= Number(invoice.total_ttc)) {
        invoice.status = InvoiceStatus.PAID;
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }
      await manager.save(invoice);

      // 7. Mettre à jour le solde du compte
      account.current_balance = Number(account.current_balance) + dto.amount;
      await manager.save(account);

      // 8. Créer la transaction
      const transaction = manager.create(Transaction, {
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.ENCAISSEMENT,
        amount: dto.amount,
        transaction_date: dto.payment_date,
        description: `Paiement facture ${invoice.invoice_number}`,
        reference: dto.reference,
        notes: dto.notes,
        related_entity_type: 'Payment',
        related_entity_id: payment.id,
        is_reconciled: false,
        created_by: userId,
      });
      await manager.save(transaction);

      return payment;
    });
  }

  async findAll(businessId: string): Promise<Payment[]> {
    return await this.paymentRepo.find({
      where: { business_id: businessId },
      relations: ['invoice', 'account'],
      order: { created_at: 'DESC' },
    });
  }

  async findByInvoice(businessId: string, invoiceId: string): Promise<Payment[]> {
    return await this.paymentRepo.find({
      where: { business_id: businessId, invoice_id: invoiceId },
      relations: ['account'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['invoice', 'account'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
