import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { TransactionType } from '../enums/transaction-type.enum';
import { InvoiceStatus } from '../../sales/entities/invoice.entity';
import { Invoice } from '../../sales/entities/invoice.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { PermissionUtil } from '../../businesses/utils/permission.util';
import { TransactionsService } from './transactions.service';

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

  async create(businessId: string, userId: string, dto: any): Promise<Payment> {
    // Check permission
    const hasPermission = await this.hasPaymentPermission(
      userId,
      businessId,
      'create_client_payment',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create client payments',
      );
    }

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

      // 8. Créer la transaction avec fraud detection
      await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.ENCAISSEMENT,
        amount: dto.amount,
        transaction_date: new Date(dto.payment_date),
        description: `Paiement facture ${invoice.invoice_number}`,
        reference: dto.reference,
        notes: dto.notes,
        related_entity_type: 'Payment',
        related_entity_id: payment.id,
        created_by: userId,
      });

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
