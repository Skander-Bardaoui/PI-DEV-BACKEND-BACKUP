import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SupplierPayment }  from '../entities/supplier-payment.entity';

import { Account }          from '../../payments/entities/account.entity';
import { Transaction }      from '../../payments/entities/transaction.entity';
import { TransactionType }  from '../../payments/enums/transaction-type.enum';
import { PurchaseInvoice } from 'src/Purchases/entities/purchase-invoice.entity';
import { InvoiceStatus } from 'src/Purchases/enum/invoice-status.enum';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,

    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,

    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, userId: string, dto: any): Promise<SupplierPayment> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Vérifier le compte
      const account = await manager.findOne(Account, {
        where: { id: dto.account_id, business_id: businessId, is_active: true },
      });
      if (!account) throw new NotFoundException('Account not found or inactive');

      if (Number(account.current_balance) < dto.amount) {
        throw new BadRequestException(
          `Solde insuffisant. Disponible: ${account.current_balance}`,
        );
      }

      // 2. Vérifier la facture fournisseur si fournie
      let invoice: PurchaseInvoice | null = null;
      if (dto.purchase_invoice_id) {
        invoice = await manager.findOne(PurchaseInvoice, {
          where: { id: dto.purchase_invoice_id, business_id: businessId },
        });
        if (!invoice) throw new NotFoundException('Purchase invoice not found');

        if (invoice.supplier_id !== dto.supplier_id) {
          throw new BadRequestException(
            `La facture n'appartient pas au fournisseur sélectionné.`,
          );
        }

        const payable = [
          InvoiceStatus.APPROVED,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
          InvoiceStatus.DISPUTED,
        ];
        if (!payable.includes(invoice.status)) {
          throw new BadRequestException(
            `Facture en statut "${invoice.status}" — non payable.`,
          );
        }

        const remaining = this.round(Number(invoice.net_amount) - Number(invoice.paid_amount));
        if (dto.amount > remaining + 0.005) {
          throw new BadRequestException(
            `Montant (${dto.amount}) supérieur au reste à payer (${remaining}).`,
          );
        }
      }

      // 3. Générer le numéro de paiement
      const payment_number = await this.generateNumber(businessId, manager);

      // 4. Créer le paiement fournisseur
      const payment = manager.create(SupplierPayment, {
        business_id: businessId,
        supplier_id: dto.supplier_id,
        purchase_invoice_id: dto.purchase_invoice_id ?? null,
        account_id: dto.account_id,
        payment_number,
        payment_date: new Date(dto.payment_date),
        amount: dto.amount,
        payment_method: dto.payment_method,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        created_by: userId,
      });
      const saved = await manager.save(SupplierPayment, payment);

      // 5. Mettre à jour la facture fournisseur si fournie
      if (invoice) {
        const newPaid = this.round(Number(invoice.paid_amount) + dto.amount);
        invoice.paid_amount = newPaid;

        if (newPaid >= Number(invoice.net_amount) - 0.005) {
          invoice.status = InvoiceStatus.PAID;
        } else {
          invoice.status = InvoiceStatus.PARTIALLY_PAID;
        }
        await manager.save(PurchaseInvoice, invoice);
      }

      // 6. Débiter le compte
      account.current_balance = Number(account.current_balance) - dto.amount;
      await manager.save(Account, account);

      // 7. Créer la transaction DECAISSEMENT
      const description = invoice
        ? `Paiement fournisseur facture ${invoice.invoice_number_supplier}`
        : `Paiement fournisseur ${payment_number}`;

      const transaction = manager.create(Transaction, {
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.DECAISSEMENT,
        amount: dto.amount,
        transaction_date: dto.payment_date,
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'SupplierPayment',
        related_entity_id: saved.id,
        is_reconciled: false,
        created_by: userId,
      });
      await manager.save(Transaction, transaction);

      return manager.findOne(SupplierPayment, {
        where: { id: saved.id },
        relations: ['supplier', 'purchase_invoice'],
      }) as Promise<SupplierPayment>;
    });
  }

  async findAll(businessId: string): Promise<SupplierPayment[]> {
    return await this.paymentRepo.find({
      where: { business_id: businessId },
      relations: ['supplier', 'purchase_invoice', 'account'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<SupplierPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['supplier', 'purchase_invoice', 'account'],
    });
    if (!payment) throw new NotFoundException('Supplier payment not found');
    return payment;
  }

  async findBySupplier(businessId: string, supplierId: string): Promise<SupplierPayment[]> {
    return await this.paymentRepo.find({
      where: { business_id: businessId, supplier_id: supplierId },
      relations: ['purchase_invoice', 'account'],
      order: { created_at: 'DESC' },
    });
  }

  async getSupplierStats(businessId: string, supplierId: string) {
    const result = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total_paid')
      .addSelect('COUNT(p.id)', 'payment_count')
      .where('p.business_id = :businessId AND p.supplier_id = :supplierId', {
        businessId, supplierId,
      })
      .getRawOne();
    return {
      total_paid:    Number(result.total_paid)    || 0,
      payment_count: Number(result.payment_count) || 0,
    };
  }

  private async generateNumber(businessId: string, manager: any): Promise<string> {
    const year   = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING(payment_number FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM supplier_payments
      WHERE business_id = $1 AND payment_number LIKE $2`,
      [businessId, `${prefix}%`],
    );
    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}
