// src/Purchases/services/purchase-mail.service.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import * as nodemailer        from 'nodemailer';
import { SupplierPO }         from '../entities/supplier-po.entity';
import { PurchaseInvoice }    from '../entities/purchase-invoice.entity';
import { SupplierPortalService } from './supplier-portal.service';
import { Business }           from '../../businesses/entities/business.entity';
import { Tenant }             from '../../tenants/entities/tenant.entity';
import { User }               from '../../users/entities/user.entity';

@Injectable()
export class PurchaseMailService {

  private readonly logger     = new Logger(PurchaseMailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from:        string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,

    @Inject(forwardRef(() => SupplierPortalService))
    private readonly portalService: SupplierPortalService,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.from        = config.get<string>('GMAIL_USER', 'no-reply@platform.tn');
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.get<string>('GMAIL_USER'),
        pass: config.get<string>('GMAIL_PASS'),
      },
    });
  }

  // ─── Helper : résoudre les destinataires owner ────────────────────────────
  private async resolveOwnerRecipients(businessId: string): Promise<{
    recipients: string;
    businessName: string;
    businessEmail: string;
    businessPhone: string;
    businessMF: string;
  }> {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    const businessName  = business?.name  ?? 'Notre société';
    const businessEmail = business?.email ?? '';
    const businessPhone = business?.phone ?? '';
    const businessMF    = business?.tax_id ?? '';

    let ownerEmail = '';
    if (business?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: business.tenant_id } });
      if (tenant?.ownerId) {
        const owner = await this.userRepo.findOne({ where: { id: tenant.ownerId } });
        ownerEmail = owner?.email ?? '';
      }
    }

    const emailSet = new Set<string>(
      [businessEmail, ownerEmail].filter(e => !!e && e.includes('@'))
    );
    const recipients = Array.from(emailSet).join(',');

    return { recipients, businessName, businessEmail, businessPhone, businessMF };
  }

  // ─── Envoi du BC au fournisseur ───────────────────────────────────────────
  async sendPurchaseOrder(po: SupplierPO): Promise<void> {
    const supplier = po.supplier;

    if (!supplier?.email) {
      this.logger.warn(`BC ${po.po_number} : fournisseur "${supplier?.name}" sans email.`);
      return;
    }

    const { businessName, businessEmail, businessPhone, businessMF } =
      await this.resolveOwnerRecipients(po.business_id);

    const portalToken = await this.portalService.generatePortalToken(
      po.business_id,
      supplier.id,
      po.id,
    );
    const portalUrl = `${this.frontendUrl}/supplier-portal?token=${encodeURIComponent(portalToken)}`;

    const itemsHtml = (po.items ?? []).map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">${Number(item.quantity_ordered).toFixed(3)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">${Number(item.unit_price_ht).toFixed(3)} TND</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${item.tax_rate_value}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:600;">${Number(item.line_total_ht).toFixed(3)} TND</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
<div style="background:#4F46E5;padding:24px;color:#fff;"><h1 style="margin:0;">${businessName}</h1><p style="margin:4px 0 0;">BC ${po.po_number}</p></div>
<div style="background:#fff;padding:24px;"><p>Bonjour <strong>${supplier.name}</strong>,</p><p>Veuillez trouver ci-joint notre bon de commande.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;"><thead><tr style="background:#f3f4f6;"><th style="padding:10px;text-align:left;">Description</th><th style="padding:10px;text-align:right;">Qté</th><th style="padding:10px;text-align:right;">P.U. HT</th><th style="padding:10px;text-align:center;">TVA</th><th style="padding:10px;text-align:right;">Total HT</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div style="text-align:right;margin:20px 0;"><table style="margin-left:auto;"><tr><td style="padding:8px;">Sous-total HT</td><td style="padding:8px;text-align:right;">${Number(po.subtotal_ht).toFixed(3)} TND</td></tr><tr><td style="padding:8px;">TVA</td><td style="padding:8px;text-align:right;">${Number(po.tax_amount).toFixed(3)} TND</td></tr><tr><td style="padding:8px;">Timbre</td><td style="padding:8px;text-align:right;">1,000 TND</td></tr><tr style="font-weight:bold;"><td style="padding:8px;">Net TTC</td><td style="padding:8px;text-align:right;">${Number(po.net_amount).toFixed(3)} TND</td></tr></table></div>
<div style="text-align:center;padding:20px;background:#f0f4ff;border-radius:8px;margin:20px 0;"><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">Accéder au portail fournisseur</a></div>
<p>Cordialement,<br><strong>${businessName}</strong></p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        replyTo: businessEmail || this.from,
        to: supplier.email,
        subject: `Bon de Commande ${po.po_number} — ${businessName}`,
        html,
      });
      this.logger.log(`Email BC ${po.po_number} envoyé à ${supplier.email}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi email BC ${po.po_number}: ${err.message}`);
      throw err;
    }
  }

  // ─── Notification owner : BC confirmé ────────────────────────────────────
  async sendPOConfirmedToOwner(po: SupplierPO): Promise<void> {
    const { recipients, businessName } = await this.resolveOwnerRecipients(po.business_id);
    if (!recipients) return;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:#16A34A;padding:20px;color:#fff;"><h2 style="margin:0;">✓ BC confirmé</h2><p style="margin:4px 0 0;">${po.po_number}</p></div>
<div style="background:#fff;padding:20px;"><p>Bonjour,</p><p><strong>${po.supplier?.name}</strong> a confirmé votre BC <strong>${po.po_number}</strong> (${Number(po.net_amount).toFixed(3)} TND TTC).</p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        to: recipients,
        subject: `✓ BC ${po.po_number} confirmé`,
        html,
      });
      this.logger.log(`Email confirmation BC ${po.po_number} envoyé`);
    } catch (err: any) {
      this.logger.error(`Échec email confirmation BC: ${err.message}`);
    }
  }

  // ─── Notification owner : BC refusé ──────────────────────────────────────
  async sendPORefusedToOwner(po: SupplierPO, reason: string): Promise<void> {
    const { recipients, businessName } = await this.resolveOwnerRecipients(po.business_id);
    if (!recipients) return;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:#DC2626;padding:20px;color:#fff;"><h2 style="margin:0;">✗ BC refusé</h2><p style="margin:4px 0 0;">${po.po_number}</p></div>
<div style="background:#fff;padding:20px;"><p>Bonjour,</p><p><strong>${po.supplier?.name}</strong> a refusé votre BC <strong>${po.po_number}</strong>.</p><p><strong>Motif:</strong> ${reason}</p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        to: recipients,
        subject: `✗ BC ${po.po_number} refusé`,
        html,
      });
      this.logger.log(`Email refus BC ${po.po_number} envoyé`);
    } catch (err: any) {
      this.logger.error(`Échec email refus BC: ${err.message}`);
    }
  }

  // ─── Envoi email au fournisseur pour écart de facture ─────────────────────
  async sendInvoiceDiscrepancyEmail(
    businessId: string,
    supplierEmail: string,
    supplierName: string,
    invoiceNumber: string,
    invoicedTotal: number,
    expectedTotal: number,
    discrepancy: number,
    discrepancyPct: number,
    issues: string[],
  ): Promise<void> {
    if (!supplierEmail) {
      this.logger.warn(`Impossible d'envoyer l'email : fournisseur "${supplierName}" sans email.`);
      return;
    }

    const { businessName, businessEmail, businessPhone } =
      await this.resolveOwnerRecipients(businessId);

    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }).format(amount);
    };

    const issuesList = issues && issues.length > 0
      ? issues.map((issue, i) => `<li>${i + 1}. ${issue}</li>`).join('')
      : '<li>Aucun problème spécifique identifié</li>';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;"><h2 style="margin:0;">⚠️ Écart détecté sur facture</h2><p style="margin:5px 0 0;">Facture ${invoiceNumber}</p></div>
<div style="background:#f9fafb;padding:20px;"><p>Bonjour <strong>${supplierName}</strong>,</p><p>Nous avons détecté un écart sur votre facture <strong>${invoiceNumber}</strong>.</p>
<table style="width:100%;margin:20px 0;"><tr><td style="padding:10px;font-weight:bold;">Montant facturé</td><td style="padding:10px;text-align:right;color:#7c3aed;font-weight:bold;">${formatAmount(invoicedTotal)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Montant attendu</td><td style="padding:10px;text-align:right;color:#10b981;font-weight:bold;">${formatAmount(expectedTotal)}</td></tr>
<tr><td style="padding:10px;font-weight:bold;">Écart</td><td style="padding:10px;text-align:right;color:#ef4444;font-weight:bold;">${formatAmount(discrepancy)} (${discrepancyPct.toFixed(2)}%)</td></tr></table>
<h3 style="color:#ef4444;">Problèmes identifiés:</h3><ul>${issuesList}</ul>
<p><strong>Action requise:</strong> Merci de vérifier et nous fournir des clarifications.</p>
<p>Contact: <a href="mailto:${businessEmail}">${businessEmail}</a>${businessPhone ? ` | ${businessPhone}` : ''}</p>
<p>Cordialement,<br><strong>${businessName}</strong></p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        replyTo: businessEmail || this.from,
        to: supplierEmail,
        subject: `⚠️ Écart détecté sur facture ${invoiceNumber}`,
        html,
      });
      this.logger.log(`Email écart facture envoyé à ${supplierEmail} pour ${invoiceNumber}`);
    } catch (error: any) {
      this.logger.error(`Échec envoi email écart facture ${invoiceNumber}: ${error.message}`);
      throw error;
    }
  }

  // ─── Envoi email de clarification au fournisseur ─────────────────────────
  async sendDisputeClarificationEmail(
    businessId: string,
    supplierEmail: string,
    supplierName: string,
    invoiceNumber: string,
    disputeReason: string,
    clarificationNotes: string,
    disputeCategory?: string,
    invoicedAmount?: number,
    expectedAmount?: number,
    discrepancy?: number,
    accessToken?: string,
  ): Promise<void> {
    if (!supplierEmail) {
      this.logger.warn(`Impossible d'envoyer l'email : fournisseur "${supplierName}" sans email.`);
      return;
    }

    const { businessName, businessEmail, businessPhone } =
      await this.resolveOwnerRecipients(businessId);

    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }).format(amount);
    };

    let categoryTitle = 'Clarification Requise';
    let categoryIcon = '❓';
    
    if (disputeCategory) {
      switch (disputeCategory) {
        case 'PRICE_DISCREPANCY':
          categoryTitle = 'Écart de Prix Détecté';
          categoryIcon = '💰';
          break;
        case 'QUANTITY_MISMATCH':
          categoryTitle = 'Écart de Quantité';
          categoryIcon = '📦';
          break;
        case 'CALCULATION_ERROR':
          categoryTitle = 'Erreur de Calcul';
          categoryIcon = '🧮';
          break;
        case 'PARTIAL_DELIVERY':
          categoryTitle = 'Livraison Partielle';
          categoryIcon = '🚚';
          break;
      }
    }

    let amountsTable = '';
    if (invoicedAmount !== undefined && expectedAmount !== undefined && discrepancy !== undefined) {
      amountsTable = `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin:20px 0;">
<h3 style="margin:0 0 15px 0;font-size:14px;">Comparaison des Montants</h3>
<table style="width:100%;"><tr><td style="padding:8px 0;">Montant Facturé</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#7c3aed;">${formatAmount(invoicedAmount)}</td></tr>
<tr><td style="padding:8px 0;">Montant Attendu</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#10b981;">${formatAmount(expectedAmount)}</td></tr>
<tr style="border-top:2px solid #e5e7eb;"><td style="padding:8px 0;font-weight:600;">Écart</td><td style="padding:8px 0;text-align:right;font-weight:700;color:${discrepancy > 0 ? '#ef4444' : '#10b981'};">${discrepancy > 0 ? '+' : ''}${formatAmount(discrepancy)}</td></tr></table></div>`;
    }

    // Pas de génération de token - le fournisseur répondra par email
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:white;padding:30px 20px;text-align:center;">
<h1 style="margin:0;font-size:24px;">${categoryIcon} ${categoryTitle}</h1><p style="margin:10px 0 0;">Facture ${invoiceNumber}</p></div>
<div style="padding:30px 20px;"><p style="font-size:16px;">Bonjour <strong>${supplierName}</strong>,</p>
<p>Nous avons détecté une différence concernant votre facture <strong>${invoiceNumber}</strong> et souhaitons obtenir des clarifications.</p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin:20px 0;border-radius:4px;">
<h3 style="margin:0 0 10px 0;font-size:14px;color:#92400e;">Problème Identifié</h3><p style="margin:0;font-size:13px;color:#78350f;">${disputeReason}</p></div>
${amountsTable}
<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:15px;margin:20px 0;border-radius:4px;">
<h3 style="margin:0 0 10px 0;font-size:14px;color:#1e40af;">Message</h3><p style="margin:0;font-size:13px;color:#1e3a8a;white-space:pre-wrap;">${clarificationNotes}</p></div>
<h3>Action Requise</h3><p>Merci de nous fournir par email :</p><ul><li>Explication détaillée de l'écart</li><li>Documents justificatifs si nécessaire</li><li>Confirmation des montants</li></ul>

<div style="text-align:center;margin:30px 0;">
<a href="mailto:${businessEmail}?subject=RE: Facture ${invoiceNumber} - Litige&body=Bonjour,%0D%0A%0D%0AConcernant la facture ${invoiceNumber}:%0D%0A%0D%0A[Votre réponse ici]%0D%0A%0D%0ACordialement" style="display:inline-block;padding:14px 28px;background:#f59e0b;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 6px rgba(245,158,11,0.3);">📧 Répondre par Email</a>
<p style="margin:15px 0 0 0;font-size:13px;color:#92400e;">Merci de répondre dans les plus brefs délais</p>
</div>

<div style="background:#f9fafb;border-radius:8px;padding:15px;margin-top:20px;"><h4 style="margin:0 0 10px 0;font-size:13px;">Contact</h4>
<p style="margin:5px 0;font-size:13px;"><strong>${businessName}</strong><br>📧 <a href="mailto:${businessEmail}">${businessEmail}</a>${businessPhone ? `<br>📞 ${businessPhone}` : ''}</p></div>
<p style="margin-top:20px;">Cordialement,<br><strong>${businessName}</strong></p></div>
<div style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#6b7280;">
<p style="margin:0;">Email généré automatiquement © ${new Date().getFullYear()} ${businessName}</p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        replyTo: businessEmail || this.from,
        to: supplierEmail,
        subject: `${categoryIcon} ${categoryTitle} - Facture ${invoiceNumber}`,
        html,
      });
      this.logger.log(`Email clarification envoyé à ${supplierEmail} pour ${invoiceNumber}`);
    } catch (error: any) {
      this.logger.error(`Échec envoi email clarification ${invoiceNumber}: ${error.message}`);
      throw error;
    }
  }

  // ─── Notification owner : Réponse du fournisseur au litige ───────────────
  async sendDisputeResponseToOwner(
    businessId: string,
    invoice: PurchaseInvoice,
    responseMessage: string,
    proposedSolution?: string,
    proposedAmount?: number,
  ): Promise<void> {
    const { recipients, businessName } = await this.resolveOwnerRecipients(businessId);
    if (!recipients) return;

    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }).format(amount);
    };

    const proposedSolutionHtml = proposedSolution
      ? `<div style="background:#e0f2fe;border-left:4px solid #0284c7;padding:15px;margin:20px 0;border-radius:4px;">
<h3 style="margin:0 0 10px 0;font-size:14px;color:#075985;">Solution Proposée</h3>
<p style="margin:0;font-size:13px;color:#0c4a6e;white-space:pre-wrap;">${proposedSolution}</p>
${proposedAmount ? `<p style="margin:10px 0 0 0;font-size:14px;font-weight:600;color:#0284c7;">Montant proposé: ${formatAmount(proposedAmount)}</p>` : ''}
</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;padding:30px 20px;text-align:center;">
<h1 style="margin:0;font-size:24px;">✅ Réponse du Fournisseur</h1>
<p style="margin:10px 0 0;">Facture ${invoice.invoice_number_supplier}</p></div>
<div style="padding:30px 20px;">
<p style="font-size:16px;">Bonjour,</p>
<p><strong>${invoice.supplier?.name}</strong> a répondu au litige concernant la facture <strong>${invoice.invoice_number_supplier}</strong>.</p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin:20px 0;border-radius:4px;">
<h3 style="margin:0 0 10px 0;font-size:14px;color:#92400e;">Message du Fournisseur</h3>
<p style="margin:0;font-size:13px;color:#78350f;white-space:pre-wrap;">${responseMessage}</p></div>
${proposedSolutionHtml}
<div style="background:#f3f4f6;border-radius:8px;padding:15px;margin:20px 0;">
<h4 style="margin:0 0 10px 0;font-size:13px;">Détails de la Facture</h4>
<table style="width:100%;font-size:13px;">
<tr><td style="padding:5px 0;">Montant facturé</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatAmount(Number(invoice.net_amount))}</td></tr>
${invoice.supplier_po ? `<tr><td style="padding:5px 0;">Montant BC</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatAmount(Number(invoice.supplier_po.net_amount))}</td></tr>` : ''}
</table></div>
<div style="text-align:center;margin:30px 0;">
<a href="${this.frontendUrl}/app/purchases/invoices" style="display:inline-block;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:6px;font-weight:600;">📋 Traiter la Réponse</a>
</div>
<p style="margin-top:20px;">Veuillez examiner la réponse et prendre les mesures appropriées.</p>
<p>Cordialement,<br><strong>Système de Gestion</strong></p></div>
<div style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#6b7280;">
<p style="margin:0;">Email généré automatiquement © ${new Date().getFullYear()} ${businessName}</p></div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        to: recipients,
        subject: `✅ Réponse du fournisseur - Facture ${invoice.invoice_number_supplier}`,
        html,
      });
      this.logger.log(`Email réponse litige envoyé pour ${invoice.invoice_number_supplier}`);
    } catch (error: any) {
      this.logger.error(`Échec envoi email réponse litige: ${error.message}`);
      throw error;
    }
  }

  // ─── Notification fournisseur : BC annulé ────────────────────────────────
  async sendCancellationEmail(po: SupplierPO): Promise<void> {
    const supplier = po.supplier;

    if (!supplier?.email) {
      this.logger.warn(`BC ${po.po_number} : fournisseur "${supplier?.name}" sans email.`);
      return;
    }

    const { businessName, businessEmail, businessPhone } =
      await this.resolveOwnerRecipients(po.business_id);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:#DC2626;padding:24px;color:#fff;"><h1 style="margin:0;">❌ Annulation de commande</h1><p style="margin:4px 0 0;">BC ${po.po_number}</p></div>
<div style="background:#fff;padding:24px;">
  <p>Bonjour <strong>${supplier.name}</strong>,</p>
  <p>Nous vous informons que le bon de commande <strong>${po.po_number}</strong> d'un montant de <strong>${Number(po.net_amount).toFixed(3)} TND TTC</strong> a été annulé.</p>
  ${po.notes ? `<div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:12px;margin:16px 0;"><p style="margin:0;"><strong>Raison :</strong></p><p style="margin:8px 0 0;">${po.notes}</p></div>` : ''}
  <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
  <p>Cordialement,<br><strong>${businessName}</strong></p>
  ${businessEmail ? `<p style="font-size:12px;color:#666;margin-top:20px;">Email : ${businessEmail}</p>` : ''}
  ${businessPhone ? `<p style="font-size:12px;color:#666;margin:0;">Téléphone : ${businessPhone}</p>` : ''}
</div>
</body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        replyTo: businessEmail || this.from,
        to: supplier.email,
        subject: `❌ Annulation BC ${po.po_number} — ${businessName}`,
        html,
      });
      this.logger.log(`Email annulation BC ${po.po_number} envoyé à ${supplier.email}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi email annulation BC ${po.po_number}: ${err.message}`);
      throw err;
    }
  }
}
