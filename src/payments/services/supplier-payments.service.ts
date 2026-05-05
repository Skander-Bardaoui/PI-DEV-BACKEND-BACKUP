import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SupplierPayment }  from '../entities/supplier-payment.entity';
import { TransactionsService } from './transactions.service';

import { Account }          from '../../payments/entities/account.entity';
import { Transaction }      from '../../payments/entities/transaction.entity';
import { TransactionType }  from '../../payments/enums/transaction-type.enum';
import { PurchaseInvoice } from '../../Purchases/entities/purchase-invoice.entity';
import { InvoiceStatus } from 'src/Purchases/enum/invoice-status.enum';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { PermissionUtil } from '../../businesses/utils/permission.util';

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

    @InjectRepository(BusinessMember)
    private readonly memberRepo: Repository<BusinessMember>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
  ) {}

  // Check if user has payment permission
  private async hasPaymentPermission(
    userId: string,
    businessId: string,
    permissionKey: string,
  ): Promise<boolean> {
    // First, check if user is a PLATFORM_ADMIN or BUSINESS_OWNER at the user level
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // PLATFORM_ADMIN always has full access
    if (user.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    // BUSINESS_OWNER: Check if they own the tenant that owns this business
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepo.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        const business = await this.businessRepo.findOne({
          where: { id: businessId },
        });

        // If the business belongs to the tenant owned by this user, they have full access
        if (business && business.tenant_id === tenant.id) {
          return true;
        }
      }
    }

    // For other roles, check BusinessMember permissions
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId, is_active: true },
      relations: ['user'],
    });

    if (!member) {
      return false;
    }

    // BUSINESS_OWNER role in business_members table also has full access
    if (member.role === Role.BUSINESS_OWNER) {
      return true;
    }

    // Check granular permission
    return PermissionUtil.hasGranularPermission(
      member.payment_permissions,
      permissionKey,
    );
  }

  async create(businessId: string, userId: string, dto: any): Promise<SupplierPayment> {
    // Check permission
    const hasPermission = await this.hasPaymentPermission(
      userId,
      businessId,
      'create_supplier_payment',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create supplier payments',
      );
    }

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

      // 7. Créer la transaction DECAISSEMENT avec fraud detection
      const description = invoice
        ? `Paiement fournisseur facture ${invoice.invoice_number_supplier}`
        : `Paiement fournisseur ${payment_number}`;

      await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.DECAISSEMENT,
        amount: dto.amount,
        transaction_date: new Date(dto.payment_date),
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'SupplierPayment',
        related_entity_id: saved.id,
        created_by: userId,
      });

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
