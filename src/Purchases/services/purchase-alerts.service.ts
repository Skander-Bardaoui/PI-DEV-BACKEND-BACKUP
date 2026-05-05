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
            message:      `La facture ${inv.invoice_number} de ${inv.supplier?.name} arrive à échéance le ${new Date(inv.due_date).toLocaleDateString('fr-TN')}. Reste à payer : ${remaining.toFixed(3)} TND.`,
            entity_type:  'PurchaseInvoice',
            entity_id:    inv.id,
            entity_label: inv.invoice_number,
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
      // Récupérer l'alerte avec ses métadonnées
      const alert = await this.alertRepo.findOne({
        where: { id: alertId, business_id: businessId },
      });

      if (!alert) {
        throw new Error('Alerte introuvable');
      }

      // Effectuer l'action appropriée selon le type d'alerte
      try {
        switch (alert.type) {
          case AlertType.PO_AWAITING_CONFIRM:
            // Renvoyer le BC au fournisseur
            await this.resendPOToSupplier(alert.entity_id);
            this.logger.log(`✅ BC ${alert.entity_label} renvoyé au fournisseur`);
            break;

          case AlertType.INVOICE_DUE_SOON:
          case AlertType.INVOICE_OVERDUE:
            // Marquer la facture comme prioritaire ou envoyer un rappel
            this.logger.log(`ℹ️ Facture ${alert.entity_label} marquée pour traitement`);
            break;

          case AlertType.PO_NOT_RECEIVED:
            // Créer une notification pour vérifier la livraison
            this.logger.log(`ℹ️ BC ${alert.entity_label} marqué pour vérification`);
            break;

          case AlertType.SUPPLIER_HIGH_DEBT:
            // Marquer le fournisseur pour révision
            this.logger.log(`ℹ️ Fournisseur ${alert.entity_label} marqué pour révision`);
            break;

          default:
            this.logger.log(`ℹ️ Alerte ${alert.type} résolue sans action spécifique`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.error(`❌ Erreur lors de la résolution de l'alerte: ${errorMessage}`);
        // On continue quand même pour marquer l'alerte comme résolue
      }

      // Marquer l'alerte comme résolue
      await this.alertRepo.update(
        { id: alertId, business_id: businessId },
        { status: AlertStatus.RESOLVED },
      );
    }

    // Méthode privée pour renvoyer un BC au fournisseur
    private async resendPOToSupplier(poId: string): Promise<void> {
      const po = await this.poRepo.findOne({
        where: { id: poId },
        relations: ['supplier', 'items', 'items.product', 'business'],
      });

      if (!po || !po.supplier?.email) {
        throw new Error('BC ou email fournisseur introuvable');
      }

      // Générer le contenu de l'email
      const itemsHtml = po.items
        ?.map(
          (item, idx) => `
          <tr style="border-bottom:1px solid #E5E7EB;">
            <td style="padding:12px 8px;text-align:center;">${idx + 1}</td>
            <td style="padding:12px 8px;">${item.description}</td>
            <td style="padding:12px 8px;text-align:center;">${item.quantity_ordered}</td>
            <td style="padding:12px 8px;text-align:right;">${Number(item.unit_price_ht).toFixed(3)} TND</td>
            <td style="padding:12px 8px;text-align:right;">${(item.quantity_ordered * Number(item.unit_price_ht)).toFixed(3)} TND</td>
          </tr>
        `,
        )
        .join('');

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:bold;">📋 Rappel - Bon de Commande</h1>
          </div>

          <div style="padding:32px 24px;">
            <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:16px;margin-bottom:24px;border-radius:4px;">
              <p style="margin:0;color:#92400E;font-size:14px;">
                <strong>⚠️ Rappel:</strong> Ce bon de commande est en attente de confirmation depuis plusieurs jours.
              </p>
            </div>

            <p style="font-size:16px;color:#374151;line-height:1.6;">
              Bonjour <strong>${po.supplier.name}</strong>,
            </p>
            <p style="font-size:14px;color:#6B7280;line-height:1.6;">
              Nous vous rappelons que le bon de commande <strong>${po.po_number}</strong> est toujours en attente de votre confirmation.
            </p>

            <div style="background:#F9FAFB;padding:20px;border-radius:8px;margin:24px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:13px;">N° BC:</td>
                  <td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;">${po.po_number}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:13px;">Date d'envoi:</td>
                  <td style="padding:8px 0;color:#111827;text-align:right;">${new Date(po.sent_at || po.created_at).toLocaleDateString('fr-TN')}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:13px;">Livraison attendue:</td>
                  <td style="padding:8px 0;color:#111827;text-align:right;">${po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString('fr-TN') : 'Non définie'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:13px;font-weight:600;">Montant TTC:</td>
                  <td style="padding:8px 0;color:#111827;font-weight:700;font-size:18px;text-align:right;">${Number(po.net_amount).toFixed(3)} TND</td>
                </tr>
              </table>
            </div>

            <h3 style="color:#111827;font-size:16px;margin:24px 0 12px;">Articles commandés</h3>
            <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#F3F4F6;">
                  <th style="padding:12px 8px;text-align:center;font-size:13px;color:#6B7280;">#</th>
                  <th style="padding:12px 8px;text-align:left;font-size:13px;color:#6B7280;">Description</th>
                  <th style="padding:12px 8px;text-align:center;font-size:13px;color:#6B7280;">Qté</th>
                  <th style="padding:12px 8px;text-align:right;font-size:13px;color:#6B7280;">P.U. HT</th>
                  <th style="padding:12px 8px;text-align:right;font-size:13px;color:#6B7280;">Total HT</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            ${po.notes ? `
              <div style="margin-top:24px;padding:16px;background:#FEF9E7;border-left:4px solid #F59E0B;border-radius:4px;">
                <p style="margin:0;font-size:13px;color:#92400E;"><strong>📝 Notes:</strong></p>
                <p style="margin:8px 0 0;font-size:13px;color:#6B7280;">${po.notes}</p>
              </div>
            ` : ''}

            <div style="margin-top:32px;padding:20px;background:#EEF2FF;border-radius:8px;text-align:center;">
              <p style="margin:0 0 16px;font-size:14px;color:#4338CA;">
                Merci de confirmer la réception de ce bon de commande dans les plus brefs délais.
              </p>
              <a href="${this.config.get('FRONTEND_URL')}/supplier-portal" 
                 style="display:inline-block;padding:12px 32px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                Accéder au portail fournisseur
              </a>
            </div>

            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E7EB;">
              <p style="font-size:13px;color:#6B7280;margin:0;">
                Cordialement,<br>
                <strong>${po.business?.name || 'L\'équipe'}</strong>
              </p>
              ${po.business?.email ? `<p style="font-size:12px;color:#9CA3AF;margin:8px 0 0;">📧 ${po.business.email}</p>` : ''}
              ${po.business?.phone ? `<p style="font-size:12px;color:#9CA3AF;margin:4px 0 0;">📞 ${po.business.phone}</p>` : ''}
            </div>
          </div>

          <div style="background:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="font-size:11px;color:#9CA3AF;margin:0;">
              Cet email est un rappel automatique. Si vous avez déjà confirmé ce BC, veuillez ignorer ce message.
            </p>
          </div>
        </div>
      `;

      // Envoyer l'email
      await this.transporter.sendMail({
        from: `"${po.business?.name || 'Achats'}" <${this.from}>`,
        to: po.supplier.email,
        subject: `[RAPPEL] Bon de commande ${po.po_number} en attente de confirmation`,
        html: emailHtml,
      });

      this.logger.log(`✅ Email de rappel envoyé à ${po.supplier.name} (${po.supplier.email})`);
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