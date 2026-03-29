  // src/Purchases/services/purchase-alerts.service.ts
  import { Injectable, Logger } from '@nestjs/common';
  import { InjectRepository }   from '@nestjs/typeorm';
  import { Repository, LessThan, In } from 'typeorm';
  import { Cron, CronExpression }     from '@nestjs/schedule';
  import { ConfigService }            from '@nestjs/config';
  import * as nodemailer              from 'nodemailer';

  import {
    PurchaseAlert, AlertType,
  } from '../entities/purchase-alert.entity';
  import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
  import { SupplierPO }      from '../entities/supplier-po.entity';
  import { Supplier }        from '../entities/supplier.entity';
  import { InvoiceStatus }   from '../enum/invoice-status.enum';
  import { POStatus }        from '../enum/po-status.enum';
  import { SupplierPayment } from '../../payments/entities/supplier-payment.entity';
  import { User } from '../../users/entities/user.entity';
  import { Tenant } from '../../tenants/entities/tenant.entity';
  import { Business } from '../../businesses/entities/business.entity';
import { AlertStatus } from '../enum/alertStatus';
import { AlertSeverity } from '../enum/alertSeverity';

  // Seuils configurables
  const THRESHOLDS = {
    INVOICE_DUE_DAYS:        [7, 3, 1],   // J-7, J-3, J-1
    PO_NOT_RECEIVED_DAYS:    7,            // BC confirmé non reçu depuis 7 jours
    PO_AWAITING_CONFIRM_DAYS: 3,           // BC envoyé non confirmé depuis 3 jours
    SUPPLIER_HIGH_DEBT:      10_000,       // 10 000 TND
    INVOICE_HIGH_AMOUNT:     50_000,       // 50 000 TND
  };

  @Injectable()
  export class PurchaseAlertsService {

    private readonly logger      = new Logger(PurchaseAlertsService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from:        string;

    constructor(
      @InjectRepository(PurchaseAlert)
      private readonly alertRepo: Repository<PurchaseAlert>,

      @InjectRepository(PurchaseInvoice)
      private readonly invoiceRepo: Repository<PurchaseInvoice>,

      @InjectRepository(SupplierPO)
      private readonly poRepo: Repository<SupplierPO>,

      @InjectRepository(SupplierPayment)
      private readonly paymentRepo: Repository<SupplierPayment>,

      @InjectRepository(Supplier)
      private readonly supplierRepo: Repository<Supplier>,

        // ✅ NOUVEAUX REPOSITORIES
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly config: ConfigService,
    ) {
      this.from = config.get<string>('GMAIL_USER', 'no-reply@platform.tn');
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.get<string>('GMAIL_USER'),
          pass: config.get<string>('GMAIL_PASS'),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRON — tous les matins à 7h00
    // ─────────────────────────────────────────────────────────────────────────
    @Cron('0 7 * * *', { name: 'purchase-alerts' })
    async runDailyAlerts(): Promise<void> {
      this.logger.log('Démarrage du scan des alertes achats...');
      await Promise.all([
        this.checkInvoicesDueSoon(),
        this.checkPOsNotReceived(),
        this.checkPOsAwaitingConfirm(),
        this.checkSuppliersHighDebt(),
      ]);
      this.logger.log('Scan des alertes achats terminé.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Factures qui approchent l'échéance (J-7, J-3, J-1)
    // ─────────────────────────────────────────────────────────────────────────
    private async checkInvoicesDueSoon(): Promise<void> {
      const today = new Date();

      for (const days of THRESHOLDS.INVOICE_DUE_DAYS) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + days);
        const dateStr = targetDate.toISOString().split('T')[0];

        const invoices = await this.invoiceRepo
          .createQueryBuilder('inv')
          .leftJoinAndSelect('inv.supplier', 'supplier')
          .where('inv.status IN (:...statuses)', {
            statuses: [InvoiceStatus.APPROVED, InvoiceStatus.PARTIALLY_PAID],
          })
          .andWhere('DATE(inv.due_date) = :date', { date: dateStr })
          .getMany();

        for (const inv of invoices) {
          const existingAlerts = await this.alertRepo.find({
            where: {
              type: AlertType.INVOICE_DUE_SOON,
              status: In([AlertStatus.UNREAD, AlertStatus.READ]),
            },
          });

          const existingIds = new Set(existingAlerts.map(a => a.entity_id));
        if (existingIds.has(inv.id)) continue;

          const remaining = Math.round(
            (Number(inv.net_amount) - Number(inv.paid_amount)) * 1000,
          ) / 1000;

          const alert = await this.createAlert({
            business_id:  inv.business_id,
            type:         AlertType.INVOICE_DUE_SOON,
            severity:     days === 1 ? AlertSeverity.DANGER : days === 3 ? AlertSeverity.WARNING : AlertSeverity.INFO,
            title:        `Facture à payer dans ${days} jour${days > 1 ? 's' : ''}`,
            message:      `La facture ${inv.invoice_number_supplier} de ${inv.supplier?.name} arrive à échéance le ${new Date(inv.due_date).toLocaleDateString('fr-TN')}. Reste à payer : ${remaining.toFixed(3)} TND.`,
            entity_type:  'PurchaseInvoice',
            entity_id:    inv.id,
            entity_label: inv.invoice_number_supplier,
            metadata:     { days_remaining: days, remaining_amount: remaining, supplier_name: inv.supplier?.name },
          });

          await this.sendAlertEmail(alert, inv.business_id);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. BCs confirmés non réceptionnés depuis X jours
    // ─────────────────────────────────────────────────────────────────────────
    private async checkPOsNotReceived(): Promise<void> {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - THRESHOLDS.PO_NOT_RECEIVED_DAYS);

      const pos = await this.poRepo
        .createQueryBuilder('po')
        .leftJoinAndSelect('po.supplier', 'supplier')
        .where('po.status = :status', { status: POStatus.CONFIRMED })
        .andWhere('po.updated_at < :threshold', { threshold })
        .getMany();

      for (const po of pos) {
        const existing = await this.alertRepo.findOne({
          where: {
            business_id: po.business_id,
            entity_id: po.id,
            type:      AlertType.PO_NOT_RECEIVED,
            status:    In([AlertStatus.UNREAD, AlertStatus.READ]),
          },
        });
        if (existing) continue;

        const daysSince = Math.floor(
          (Date.now() - new Date(po.updated_at).getTime()) / (1000 * 60 * 60 * 24),
        );

        const alert = await this.createAlert({
          business_id:  po.business_id,
          type:         AlertType.PO_NOT_RECEIVED,
          severity:     AlertSeverity.WARNING,
          title:        `BC confirmé non réceptionné depuis ${daysSince} jours`,
          message:      `Le bon de commande ${po.po_number} (${po.supplier?.name}) a été confirmé il y a ${daysSince} jours mais aucun bon de réception n'a été créé. Vérifiez l'état de la livraison.`,
          entity_type:  'SupplierPO',
          entity_id:    po.id,
          entity_label: po.po_number,
          metadata:     { days_since_confirmed: daysSince, supplier_name: po.supplier?.name, net_amount: po.net_amount },
        });

        await this.sendAlertEmail(alert, po.business_id);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. BCs envoyés non confirmés depuis X jours
    // ─────────────────────────────────────────────────────────────────────────
    private async checkPOsAwaitingConfirm(): Promise<void> {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - THRESHOLDS.PO_AWAITING_CONFIRM_DAYS);

      const pos = await this.poRepo
        .createQueryBuilder('po')
        .leftJoinAndSelect('po.supplier', 'supplier')
        .where('po.status = :status', { status: POStatus.SENT })
        .andWhere('po.sent_at < :threshold', { threshold })
        .getMany();

      for (const po of pos) {
        const existing = await this.alertRepo.findOne({
          where: {
            business_id: po.business_id,
            entity_id: po.id,
            type:      AlertType.PO_AWAITING_CONFIRM,
            status:    In([AlertStatus.UNREAD, AlertStatus.READ]),
          },
        });
        if (existing) continue;

              // APRÈS — fallback sur created_at si sent_at est null
              const sentDate  = po.sent_at ?? po.created_at;
              const daysSince = Math.floor(
                (Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24)
              );

        await this.createAlert({
          business_id:  po.business_id,
          type:         AlertType.PO_AWAITING_CONFIRM,
          severity:     AlertSeverity.INFO,
          title:        `BC en attente de confirmation depuis ${daysSince} jours`,
          message:      `Le bon de commande ${po.po_number} envoyé à ${po.supplier?.name} n'a pas encore été confirmé. Pensez à relancer le fournisseur.`,
          entity_type:  'SupplierPO',
          entity_id:    po.id,
          entity_label: po.po_number,
          metadata:     { days_waiting: daysSince, supplier_name: po.supplier?.name },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Fournisseurs avec solde impayé élevé
    // ─────────────────────────────────────────────────────────────────────────
    private async checkSuppliersHighDebt(): Promise<void> {
      const invoices = await this.invoiceRepo
        .createQueryBuilder('inv')
        .select('inv.supplier_id', 'supplier_id')
        .addSelect('inv.business_id', 'business_id')
        .addSelect('SUM(inv.net_amount - inv.paid_amount)', 'total_due')
        .where('inv.status IN (:...statuses)', {
          statuses: [
            InvoiceStatus.APPROVED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
          ],
        })
        .groupBy('inv.supplier_id')
        .addGroupBy('inv.business_id')
        .having('SUM(inv.net_amount - inv.paid_amount) > :threshold', {
          threshold: THRESHOLDS.SUPPLIER_HIGH_DEBT,
        })
        .getRawMany();

      for (const row of invoices) {
        const supplier = await this.supplierRepo.findOne({
          where: { id: row.supplier_id },
        });
        if (!supplier) continue;

        const totalDue = Math.round(Number(row.total_due) * 1000) / 1000;

        const existing = await this.alertRepo.findOne({
          where: {
            business_id: row.business_id,
            entity_id: row.supplier_id,
            type:      AlertType.SUPPLIER_HIGH_DEBT,
            status:    In([AlertStatus.UNREAD, AlertStatus.READ]),
          },
        });

        if (existing) {
          // Mettre à jour le montant si l'alerte existe déjà
          existing.message  = `Le solde impayé envers ${supplier.name} atteint ${totalDue.toFixed(3)} TND (seuil : ${THRESHOLDS.SUPPLIER_HIGH_DEBT.toLocaleString()} TND).`;
          existing.metadata = { ...existing.metadata, total_due: totalDue };
          await this.alertRepo.save(existing);
          continue;
        }

        await this.createAlert({
          business_id:  row.business_id,
          type:         AlertType.SUPPLIER_HIGH_DEBT,
          severity:     AlertSeverity.DANGER,
          title:        `Solde impayé élevé — ${supplier.name}`,
          message:      `Le solde impayé envers ${supplier.name} atteint ${totalDue.toFixed(3)} TND, dépassant le seuil de ${THRESHOLDS.SUPPLIER_HIGH_DEBT.toLocaleString()} TND.`,
          entity_type:  'Supplier',
          entity_id:    row.supplier_id,
          entity_label: supplier.name,
          metadata:     { total_due: totalDue, supplier_name: supplier.name },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API — Récupérer les alertes d'un business
    // ─────────────────────────────────────────────────────────────────────────
    async findAll(businessId: string, status?: AlertStatus) {
      const qb = this.alertRepo
        .createQueryBuilder('alert')
        .where('alert.business_id = :businessId', { businessId })
        .orderBy('alert.created_at', 'DESC');

      if (status) {
        qb.andWhere('alert.status = :status', { status });
      } else {
        // Par défaut : ne pas afficher les RESOLVED et SNOOZED expirés
        qb.andWhere('alert.status != :resolved', { resolved: AlertStatus.RESOLVED });
      }

      const alerts = await qb.getMany();

      // Filtrer les snoozed expirés
      return alerts.filter(a => {
        if (a.status === AlertStatus.SNOOZED && a.snoozed_until) {
          return new Date() > a.snoozed_until;
        }
        return true;
      });
    }

    async getUnreadCount(businessId: string): Promise<number> {
      return this.alertRepo.count({
        where: { business_id: businessId, status: AlertStatus.UNREAD },
      });
    }

    async markAsRead(businessId: string, alertId: string): Promise<void> {
      await this.alertRepo.update(
        { id: alertId, business_id: businessId },
        { status: AlertStatus.READ },
      );
    }

    async markAllAsRead(businessId: string): Promise<void> {
      await this.alertRepo.update(
        { business_id: businessId, status: AlertStatus.UNREAD },
        { status: AlertStatus.READ },
      );
    }

    async resolve(businessId: string, alertId: string): Promise<void> {
      await this.alertRepo.update(
        { id: alertId, business_id: businessId },
        { status: AlertStatus.RESOLVED },
      );
    }

    async snooze(businessId: string, alertId: string, hours: number): Promise<void> {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);
      await this.alertRepo.update(
        { id: alertId, business_id: businessId },
        { status: AlertStatus.SNOOZED, snoozed_until: snoozeUntil },
      );
    }

    // Déclencher le scan manuellement (pour tests)
    async triggerManualScan(businessId: string): Promise<{ created: number }> {
      const before = await this.alertRepo.count({ where: { business_id: businessId } });
      await this.runDailyAlerts();
      const after = await this.alertRepo.count({ where: { business_id: businessId } });
      return { created: after - before };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVÉ
    // ─────────────────────────────────────────────────────────────────────────
    private async createAlert(data: Partial<PurchaseAlert>): Promise<PurchaseAlert> {
      const alert = this.alertRepo.create(data);
      return this.alertRepo.save(alert);
    }

  private async sendAlertEmail(alert: PurchaseAlert, businessId: string): Promise<void> {
    // ← NOUVEAU : récupérer l'email du owner dynamiquement
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    const tenant = await this.tenantRepo.findOne({ where: { id: business?.tenant_id } });
    const owner = await this.userRepo.findOne({ where: { id: tenant?.ownerId } });
    
    // Alertes critiques (DANGER) → business owner + business.email
    // Alertes informatives → seulement si seuil DANGER
    const isDanger = alert.severity === AlertSeverity.DANGER;
    
    const recipients = [
      owner?.email,
      isDanger ? business?.email : null,
    ].filter(Boolean).join(',');
    
    if (!recipients) return;

      const severityColors: Record<AlertSeverity, string> = {
        [AlertSeverity.INFO]:    '#3B82F6',
        [AlertSeverity.WARNING]: '#F59E0B',
        [AlertSeverity.DANGER]:  '#EF4444',
      };

      const color = severityColors[alert.severity];

      try {
        await this.transporter.sendMail({
          from:    `"Alertes Achats" <${this.from}>`,
          to:      recipients,
          subject: `[${alert.severity}] ${alert.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:${color};padding:16px 24px;border-radius:8px 8px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:18px;">${alert.title}</h2>
              </div>
              <div style="background:#fff;padding:20px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">
                <p style="font-size:14px;color:#374151;line-height:1.6;">${alert.message}</p>
                ${alert.entity_label ? `<p style="font-size:13px;color:#6B7280;">Référence : <strong>${alert.entity_label}</strong></p>` : ''}
                <p style="font-size:12px;color:#9CA3AF;margin-top:16px;">
                  Alerte générée le ${new Date(alert.created_at).toLocaleDateString('fr-TN')} à ${new Date(alert.created_at).toLocaleTimeString('fr-TN')}
                </p>
              </div>
            </div>
          `,
        });

        await this.alertRepo.update({ id: alert.id }, { email_sent: true });
      } catch (err: any) {
        this.logger.error(`Échec envoi email alerte ${alert.id} : ${err.message}`);
      }
    }
  }