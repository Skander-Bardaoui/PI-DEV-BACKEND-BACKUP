// src/payments/services/payment-schedule.service.ts
import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Account }                    from '../entities/account.entity';
import { SupplierPayment }            from '../entities/supplier-payment.entity';
import { TransactionType }            from '../enums/transaction-type.enum';
import { InvoiceStatus }              from 'src/Purchases/enum/invoice-status.enum';
import { PurchaseInvoice }            from '../../Purchases/entities/purchase-invoice.entity';
import { Transaction }                from '../entities/transaction.entity';
import { PaymentSchedule, ScheduleStatus } from '../entities/payment-schedule';
import { PaymentScheduleInstallment } from '../entities/payment-schedule-installment';
import { CreatePaymentScheduleDto, PayInstallmentDto } from '../dto/payment-schedule';
import { InstallmentStatus }          from '../enums/installment-status';
import { EmailService }               from 'src/email/email.service';
import { Supplier }                   from '../../Purchases/entities/supplier.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { PermissionUtil } from '../../businesses/utils/permission.util';

@Injectable()
export class PaymentScheduleService {
  constructor(
    @InjectRepository(PaymentSchedule)
    private readonly scheduleRepo: Repository<PaymentSchedule>,

    @InjectRepository(PaymentScheduleInstallment)
    private readonly installmentRepo: Repository<PaymentScheduleInstallment>,

    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,

    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(BusinessMember)
    private readonly memberRepo: Repository<BusinessMember>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
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

  // ──────────────────────────────────────────────────────────────────
  // CREATE SCHEDULE  →  sends approval email to supplier
  // ──────────────────────────────────────────────────────────────────
  async createSchedule(
    businessId: string,
    userId: string,
    dto: CreatePaymentScheduleDto,
  ): Promise<PaymentSchedule> {
    // Check permission
    const hasPermission = await this.hasPaymentPermission(
      userId,
      businessId,
      'create_schedule',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create payment schedules',
      );
    }

    const schedule = await this.dataSource.transaction(async (manager) => {

      const invoice = await manager.findOne(PurchaseInvoice, {
        where: { id: dto.purchase_invoice_id, business_id: businessId },
        relations: ['supplier'],
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');

      const payable = [
        InvoiceStatus.APPROVED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.OVERDUE,
      ];
      if (!payable.includes(invoice.status))
        throw new BadRequestException(
          `Invoice status "${invoice.status}" is not payable`,
        );

      const existing = await manager.findOne(PaymentSchedule, {
        where: { purchase_invoice_id: dto.purchase_invoice_id, business_id: businessId },
      });
      if (existing)
        throw new ConflictException(
          'A payment schedule already exists for this invoice',
        );

      const remaining = this.round(
        Number(invoice.net_amount) - Number(invoice.paid_amount),
      );
      const scheduleTotal = this.round(
        dto.installments.reduce((s, i) => s + i.amount, 0),
      );
      if (scheduleTotal > remaining + 0.005)
        throw new BadRequestException(
          `Installment total (${scheduleTotal}) exceeds remaining balance (${remaining})`,
        );

      const supplierToken = uuidv4();

      const saved = await manager.save(
        PaymentSchedule,
        manager.create(PaymentSchedule, {
          business_id:         businessId,
          purchase_invoice_id: dto.purchase_invoice_id,
          total_amount:        scheduleTotal,
          notes:               dto.notes ?? null,
          created_by:          userId,
          status:              ScheduleStatus.PENDING_APPROVAL,
          supplier_token:      supplierToken,
        }),
      );

      const lines = dto.installments.map((line, idx) =>
        manager.create(PaymentScheduleInstallment, {
          schedule_id:        saved.id,
          installment_number: idx + 1,
          due_date:           new Date(line.due_date),
          amount:             line.amount,
          payment_method:     line.payment_method,
          reference:          line.reference ?? null,
          notes:              line.notes ?? null,
          status:             InstallmentStatus.PENDING,
        }),
      );
      await manager.save(PaymentScheduleInstallment, lines);

      return manager.findOne(PaymentSchedule, {
        where: { id: saved.id },
        relations: [
          'installments',
          'purchase_invoice',
          'purchase_invoice.supplier',
        ],
      }) as Promise<PaymentSchedule>;
    });

    // ── Send email outside transaction ───────────────────────────
    const supplier = schedule.purchase_invoice?.supplier;
    if (supplier?.email) {
      await this.sendApprovalEmail(schedule, supplier).catch((err) =>
        console.error('[PaymentSchedule] email failed:', err?.message),
      );
    }

    return schedule;
  }

  // ──────────────────────────────────────────────────────────────────
  // SUPPLIER ACCEPT
  // ──────────────────────────────────────────────────────────────────
  async acceptSchedule(token: string): Promise<{ message: string }> {
    const schedule = await this.scheduleRepo.findOne({
      where: { supplier_token: token },
    });
    if (!schedule) throw new NotFoundException('Invalid or expired token');
    if (schedule.status !== ScheduleStatus.PENDING_APPROVAL)
      throw new BadRequestException(`Schedule is already ${schedule.status}`);

    schedule.status = ScheduleStatus.ACTIVE;
    await this.scheduleRepo.save(schedule);

    return { message: 'Payment schedule accepted successfully' };
  }

  // ──────────────────────────────────────────────────────────────────
  // SUPPLIER REJECT
  // ──────────────────────────────────────────────────────────────────
  async rejectSchedule(
    token: string,
    reason?: string,
  ): Promise<{ message: string }> {
    const schedule = await this.scheduleRepo.findOne({
      where: { supplier_token: token },
    });
    if (!schedule) throw new NotFoundException('Invalid or expired token');
    if (schedule.status !== ScheduleStatus.PENDING_APPROVAL)
      throw new BadRequestException(`Schedule is already ${schedule.status}`);

    schedule.status           = ScheduleStatus.REJECTED;
    schedule.rejection_reason = reason ?? null;
    await this.scheduleRepo.save(schedule);

    return { message: 'Payment schedule rejected' };
  }

  // ──────────────────────────────────────────────────────────────────
  // PAY ONE INSTALLMENT  (only allowed when schedule is ACTIVE)
  // ──────────────────────────────────────────────────────────────────
  async payInstallment(
    businessId: string,
    userId: string,
    scheduleId: string,
    installmentId: string,
    dto: PayInstallmentDto,
  ): Promise<PaymentScheduleInstallment> {
    // Check permission
    const hasPermission = await this.hasPaymentPermission(
      userId,
      businessId,
      'pay_installment',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to pay installments',
      );
    }

    return this.dataSource.transaction(async (manager) => {

      const installment = await manager.findOne(PaymentScheduleInstallment, {
        where: { id: installmentId, schedule_id: scheduleId },
        relations: ['schedule', 'schedule.purchase_invoice'],
      });
      if (!installment) throw new NotFoundException('Installment not found');

      const { schedule } = installment;

      if (schedule.business_id !== businessId)
        throw new NotFoundException('Schedule not found in this business');

      if (schedule.status !== ScheduleStatus.ACTIVE)
        throw new BadRequestException(
          `Cannot pay installment — schedule is "${schedule.status}". Supplier must accept first.`,
        );

      if (installment.status === InstallmentStatus.PAID)
        throw new BadRequestException('Installment already paid');
      if (installment.status === InstallmentStatus.CANCELLED)
        throw new BadRequestException('Installment is cancelled');

      const previous = await manager.find(PaymentScheduleInstallment, {
        where: { schedule_id: scheduleId },
        order: { installment_number: 'ASC' },
      });
      const unpaidBefore = previous.filter(
        (i) =>
          i.installment_number < installment.installment_number &&
          i.status !== InstallmentStatus.PAID &&
          i.status !== InstallmentStatus.CANCELLED,
      );
      if (unpaidBefore.length > 0)
        throw new BadRequestException(
          `Installment #${unpaidBefore[0].installment_number} must be paid first`,
        );

      const account = await manager.findOne(Account, {
        where: { id: dto.account_id, business_id: businessId, is_active: true },
      });
      if (!account) throw new NotFoundException('Account not found or inactive');
      if (Number(account.current_balance) < Number(installment.amount))
        throw new BadRequestException(
          `Insufficient balance. Available: ${account.current_balance}`,
        );

      const paymentNumber = await this.generatePaymentNumber(businessId, manager);
      const invoice       = schedule.purchase_invoice;

      const supplierPayment = manager.create(SupplierPayment, {
        business_id:         businessId,
        supplier_id:         invoice.supplier_id,
        purchase_invoice_id: invoice.id,
        account_id:          dto.account_id,
        payment_number:      paymentNumber,
        payment_date:        new Date(dto.paid_at ?? new Date().toISOString().slice(0, 10)),
        amount:              installment.amount,
        payment_method:      dto.payment_method,
        reference:           dto.reference ?? null,
        notes:               dto.notes ?? `Installment #${installment.installment_number}`,
        created_by:          userId,
      });
      const savedPayment = await manager.save(SupplierPayment, supplierPayment);

      installment.status              = InstallmentStatus.PAID;
      installment.account_id          = dto.account_id;
      installment.payment_method      = dto.payment_method;
      installment.paid_at             = new Date(
        dto.paid_at ?? new Date().toISOString().slice(0, 10),
      );
      installment.reference           = dto.reference ?? null;
      installment.notes               = dto.notes ?? installment.notes;
      installment.supplier_payment_id = savedPayment.id;
      await manager.save(PaymentScheduleInstallment, installment);

      account.current_balance = this.round(
        Number(account.current_balance) - Number(installment.amount),
      );
      await manager.save(Account, account);

      const transaction = manager.create(Transaction, {
        business_id:         businessId,
        account_id:          dto.account_id,
        type:                TransactionType.DECAISSEMENT,
        amount:              installment.amount,
        transaction_date:    dto.paid_at ?? new Date().toISOString().slice(0, 10),
        description:         `Installment #${installment.installment_number} — ${invoice.invoice_number}`,
        reference:           dto.reference ?? null,
        notes:               dto.notes ?? null,
        related_entity_type: 'PaymentScheduleInstallment',
        related_entity_id:   installment.id,
        is_reconciled:       false,
        created_by:          userId,
      } as unknown as Transaction);
      await manager.save(Transaction, transaction);

      const newPaid = this.round(
        Number(invoice.paid_amount) + Number(installment.amount),
      );
      invoice.paid_amount = newPaid;
      invoice.status = newPaid >= Number(invoice.net_amount) - 0.005
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;
      await manager.save(PurchaseInvoice, invoice);

      return installment;
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // READ
  // ──────────────────────────────────────────────────────────────────
  async findByInvoice(
    businessId: string,
    invoiceId: string,
  ): Promise<PaymentSchedule | null> {
    return this.scheduleRepo.findOne({
      where: { business_id: businessId, purchase_invoice_id: invoiceId },
      relations: ['installments', 'purchase_invoice'],
      order: { installments: { installment_number: 'ASC' } } as any,
    });
  }

  async findOne(
    businessId: string,
    scheduleId: string,
  ): Promise<PaymentSchedule> {
    const s = await this.scheduleRepo.findOne({
      where: { id: scheduleId, business_id: businessId },
      relations: ['installments', 'purchase_invoice'],
      order: { installments: { installment_number: 'ASC' } } as any,
    });
    if (!s) throw new NotFoundException('Payment schedule not found');
    return s;
  }

  // ──────────────────────────────────────────────────────────────────
  // MARK OVERDUE
  // ──────────────────────────────────────────────────────────────────
  async markOverdue(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.installmentRepo
      .createQueryBuilder()
      .update(PaymentScheduleInstallment)
      .set({ status: InstallmentStatus.OVERDUE })
      .where('status = :s AND due_date < :today', {
        s: InstallmentStatus.PENDING,
        today,
      })
      .execute();
  }

  // ──────────────────────────────────────────────────────────────────
  // EMAIL HELPER  — delegates to EmailService
  // ──────────────────────────────────────────────────────────────────
  private async sendApprovalEmail(
  schedule: PaymentSchedule,
  supplier: Supplier,
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const token       = schedule.supplier_token;
  const invoice     = schedule.purchase_invoice;

  await this.emailService.sendPaymentScheduleApprovalEmail(
    supplier.email!,
    supplier.name,
    invoice.invoice_number,
    Number(schedule.total_amount),
    schedule.installments.map((i) => ({
      installment_number: i.installment_number,
      due_date:           i.due_date,
      amount:             Number(i.amount),
    })),
    `${frontendUrl}/supplier/schedule/${token}/accept`, 
    `${frontendUrl}/supplier/schedule/${token}/reject`,
  );
}

  // ──────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────
  private async generatePaymentNumber(
    businessId: string,
    manager: any,
  ): Promise<string> {
    const year   = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const result = await manager.query(
      `SELECT COALESCE(
         MAX(CAST(SUBSTRING(payment_number FROM ${prefix.length + 1}) AS INTEGER)), 0
       ) + 1 AS next_seq
       FROM supplier_payments
       WHERE business_id = $1 AND payment_number LIKE $2`,
      [businessId, `${prefix}%`],
    );
    return `${prefix}${String(result[0]?.next_seq ?? 1).padStart(4, '0')}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}