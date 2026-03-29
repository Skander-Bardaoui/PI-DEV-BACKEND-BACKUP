// src/Purchases/services/purchase-mail.service.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import * as nodemailer        from 'nodemailer';
import { SupplierPO }         from '../entities/supplier-po.entity';
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
  // Retourne : business.email ET tenant owner email (dédupliqués, filtrés non-vides)
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

    // Chercher l'email du tenant owner via la table users
    let ownerEmail = '';
    if (business?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: business.tenant_id } });
      if (tenant?.ownerId) {
        const owner = await this.userRepo.findOne({ where: { id: tenant.ownerId } });
        ownerEmail = owner?.email ?? '';
      }
    }

    // Dédupliquer : si business.email === owner.email, n'envoyer qu'une fois
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
      this.logger.warn(
        `BC ${po.po_number} : fournisseur "${supplier?.name}" sans email — email non envoyé.`,
      );
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

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;background:#f5f5f5;padding:20px;">

  <div style="background:#4F46E5;padding:24px 32px;border-radius:8px 8px 0 0;">
    <table style="width:100%;">
      <tr>
        <td>
          <h1 style="color:#fff;margin:0;font-size:20px;">${businessName}</h1>
          ${businessMF    ? `<p style="color:#C7D2FE;margin:3px 0 0;font-size:12px;">MF : ${businessMF}</p>`   : ''}
          ${businessEmail ? `<p style="color:#C7D2FE;margin:2px 0 0;font-size:12px;">${businessEmail}</p>`     : ''}
          ${businessPhone ? `<p style="color:#C7D2FE;margin:2px 0 0;font-size:12px;">${businessPhone}</p>`     : ''}
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="color:#C7D2FE;margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Bon de Commande</p>
          <p style="color:#fff;margin:4px 0 0;font-size:22px;font-weight:700;">${po.po_number}</p>
          <p style="color:#C7D2FE;margin:4px 0 0;font-size:12px;">
            Le ${new Date().toLocaleDateString('fr-TN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          ${po.expected_delivery
            ? `<p style="color:#C7D2FE;margin:2px 0 0;font-size:12px;">Livraison souhaitée : ${new Date(po.expected_delivery).toLocaleDateString('fr-TN')}</p>`
            : ''}
        </td>
      </tr>
    </table>
  </div>

  <div style="background:#fff;padding:24px 32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">

    <table style="width:100%;margin-bottom:20px;">
      <tr>
        <td style="width:48%;vertical-align:top;padding:12px;background:#F9FAFB;border-radius:8px;">
          <p style="font-size:11px;color:#9CA3AF;text-transform:uppercase;margin:0 0 6px;letter-spacing:.05em;">De</p>
          <p style="font-weight:700;margin:0;font-size:14px;color:#111;">${businessName}</p>
          ${businessEmail ? `<p style="margin:3px 0 0;font-size:13px;color:#555;">${businessEmail}</p>` : ''}
          ${businessPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#555;">${businessPhone}</p>` : ''}
        </td>
        <td style="width:4%;"></td>
        <td style="width:48%;vertical-align:top;padding:12px;background:#F9FAFB;border-radius:8px;">
          <p style="font-size:11px;color:#9CA3AF;text-transform:uppercase;margin:0 0 6px;letter-spacing:.05em;">À</p>
          <p style="font-weight:700;margin:0;font-size:14px;color:#111;">${supplier.name}</p>
          ${supplier.email     ? `<p style="margin:3px 0 0;font-size:13px;color:#555;">${supplier.email}</p>`              : ''}
          ${supplier.phone     ? `<p style="margin:2px 0 0;font-size:13px;color:#555;">${supplier.phone}</p>`              : ''}
          ${supplier.matricule_fiscal ? `<p style="margin:2px 0 0;font-size:11px;color:#9CA3AF;">MF : ${supplier.matricule_fiscal}</p>` : ''}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#444;">
      Bonjour <strong>${supplier.name}</strong>,<br><br>
      Nous avons le plaisir de vous adresser notre bon de commande <strong>${po.po_number}</strong>.
      Veuillez en prendre connaissance et nous confirmer votre accord via le bouton ci-dessous.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F3F4F6;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;">Description</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">Qté</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">P.U. HT</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;font-weight:600;">TVA</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">Total HT</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="text-align:right;margin-bottom:24px;">
      <table style="margin-left:auto;min-width:280px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
        <tr style="background:#F9FAFB;">
          <td style="padding:8px 16px;color:#6B7280;font-size:13px;">Sous-total HT</td>
          <td style="padding:8px 16px;text-align:right;font-size:13px;">${Number(po.subtotal_ht).toFixed(3)} TND</td>
        </tr>
        <tr>
          <td style="padding:8px 16px;color:#6B7280;font-size:13px;">TVA</td>
          <td style="padding:8px 16px;text-align:right;font-size:13px;">${Number(po.tax_amount).toFixed(3)} TND</td>
        </tr>
        <tr style="background:#F9FAFB;">
          <td style="padding:8px 16px;color:#6B7280;font-size:13px;">Timbre fiscal</td>
          <td style="padding:8px 16px;text-align:right;font-size:13px;">1,000 TND</td>
        </tr>
        <tr style="background:#EEF2FF;">
          <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#3730A3;">Net TTC</td>
          <td style="padding:10px 16px;text-align:right;font-size:15px;font-weight:700;color:#3730A3;">${Number(po.net_amount).toFixed(3)} TND</td>
        </tr>
      </table>
    </div>

    ${po.notes ? `
    <div style="padding:12px 16px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400E;"><strong>Notes :</strong> ${po.notes}</p>
    </div>` : ''}

    <div style="text-align:center;padding:24px;background:#F0F4FF;border-radius:12px;border:1px solid #C7D2FE;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#3730A3;font-weight:600;">
        Confirmez ou refusez ce bon de commande en un clic
      </p>
      <p style="margin:0 0 16px;font-size:12px;color:#6B7280;">
        Accédez à votre portail sécurisé pour confirmer votre accord et suivre vos paiements.
      </p>
      <a href="${portalUrl}"
         style="display:inline-block;padding:14px 32px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:.02em;">
        Accéder à mon portail fournisseur →
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">
        Ce lien est valable 72 heures et est uniquement destiné à ${supplier.name}.
      </p>
    </div>

    <div style="padding:12px 14px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;margin-top:12px;font-size:12px;color:#166534;">
      <p style="margin:0;font-weight:600;margin-bottom:4px;">Contact de votre client</p>
      <p style="margin:0;">Pour toute question, contactez <strong>${businessName}</strong> directement :</p>
      ${businessEmail ? `<p style="margin:4px 0 0;"><a href="mailto:${businessEmail}" style="color:#166534;font-weight:600;">${businessEmail}</a></p>` : ''}
      ${businessPhone ? `<p style="margin:2px 0 0;">Tél : ${businessPhone}</p>` : ''}
      <p style="margin:8px 0 0;font-style:italic;color:#15803D;">
        Après livraison, envoyez votre facture à cette adresse email. Votre client l'enregistrera dans son système.
      </p>
    </div>

  </div>

  <div style="padding:16px 32px;background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#9CA3AF;text-align:center;">
    Cet email a été envoyé automatiquement par ${businessName}.
    Si vous n'êtes pas le destinataire prévu, veuillez ignorer ce message.
  </div>

</body>
</html>`;

    try {
      const info = await this.transporter.sendMail({
        from:    `"${businessName}" <${this.from}>`,
        replyTo: businessEmail || this.from,   // ← le fournisseur répond au business
        to:      supplier.email,
        subject: `Bon de Commande ${po.po_number} — ${businessName}`,
        html,
      });
      this.logger.log(`Email BC ${po.po_number} envoyé à ${supplier.email} (reply-to: ${businessEmail || this.from}).`);
      this.logger.debug(`Message ID: ${info.messageId}, Response: ${info.response}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi email BC ${po.po_number} à ${supplier.email} : ${err.message}`);
      this.logger.error(`Stack: ${err.stack}`);
      throw err; // Propager l'erreur pour que l'utilisateur sache qu'il y a un problème
    }
  }

  // ─── Notification owner : BC confirmé ────────────────────────────────────
  async sendPOConfirmedToOwner(po: SupplierPO): Promise<void> {
    const { recipients, businessName } = await this.resolveOwnerRecipients(po.business_id);

    if (!recipients) {
      this.logger.warn(`BC ${po.po_number} confirmé — aucun email destinataire trouvé (business.email et owner.email vides).`);
      return;
    }

    const supplier = po.supplier;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
  <div style="background:#16A34A;padding:20px 28px;border-radius:8px 8px 0 0;">
    <table style="width:100%"><tr>
      <td>
        <h2 style="color:#fff;margin:0;font-size:18px;">✓ Bon de commande confirmé</h2>
        <p style="color:#BBF7D0;margin:4px 0 0;font-size:13px;">Le fournisseur a accepté votre commande</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">${po.po_number}</p>
      </td>
    </tr></table>
  </div>
  <div style="background:#fff;padding:20px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;">
      Bonjour,<br><br>
      <strong>${supplier?.name}</strong> vient de confirmer votre bon de commande
      <strong>${po.po_number}</strong> d'un montant de
      <strong>${Number(po.net_amount).toFixed(3)} TND TTC</strong>.
    </p>
    <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <table style="width:100%;font-size:13px;">
        <tr><td style="color:#166534;padding:3px 0;"><strong>N° BC</strong></td><td style="text-align:right;color:#166534;">${po.po_number}</td></tr>
        <tr><td style="color:#166534;padding:3px 0;"><strong>Fournisseur</strong></td><td style="text-align:right;color:#166534;">${supplier?.name}</td></tr>
        <tr><td style="color:#166534;padding:3px 0;"><strong>Montant TTC</strong></td><td style="text-align:right;color:#166534;font-weight:700;">${Number(po.net_amount).toFixed(3)} TND</td></tr>
        ${po.expected_delivery
          ? `<tr><td style="color:#166534;padding:3px 0;"><strong>Livraison prévue</strong></td><td style="text-align:right;color:#166534;">${new Date(po.expected_delivery).toLocaleDateString('fr-TN')}</td></tr>`
          : ''}
      </table>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;">
      Vous pouvez maintenant créer un bon de réception lorsque les marchandises arriveront.
    </p>
  </div>
  <div style="padding:12px;text-align:center;font-size:11px;color:#9CA3AF;">
    Notification automatique — ${businessName}
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from:    `"${businessName}" <${this.from}>`,
        to:      recipients,
        subject: `✓ BC ${po.po_number} confirmé par ${supplier?.name}`,
        html,
      });
      this.logger.log(`Email confirmation BC ${po.po_number} envoyé à : ${recipients}`);
    } catch (err: any) {
      this.logger.error(`Échec email confirmation BC : ${err.message}`);
    }
  }

  // ─── Notification owner : BC refusé ──────────────────────────────────────
  async sendPORefusedToOwner(po: SupplierPO, reason: string): Promise<void> {
    const { recipients, businessName } = await this.resolveOwnerRecipients(po.business_id);

    if (!recipients) {
      this.logger.warn(`BC ${po.po_number} refusé — aucun email destinataire trouvé.`);
      return;
    }

    const supplier = po.supplier;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
  <div style="background:#DC2626;padding:20px 28px;border-radius:8px 8px 0 0;">
    <table style="width:100%"><tr>
      <td>
        <h2 style="color:#fff;margin:0;font-size:18px;">✗ Bon de commande refusé</h2>
        <p style="color:#FCA5A5;margin:4px 0 0;font-size:13px;">Le fournisseur a refusé votre commande</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">${po.po_number}</p>
      </td>
    </tr></table>
  </div>
  <div style="background:#fff;padding:20px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;">
      Bonjour,<br><br>
      <strong>${supplier?.name}</strong> a refusé votre bon de commande <strong>${po.po_number}</strong>.
    </p>
    <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <p style="font-size:13px;font-weight:600;color:#991B1B;margin:0 0 8px;">Motif du refus :</p>
      <p style="font-size:13px;color:#7F1D1D;margin:0;">${reason}</p>
    </div>
    <div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;margin:12px 0;">
      <table style="width:100%;font-size:13px;">
        <tr><td style="color:#6B7280;padding:2px 0;">N° BC</td><td style="text-align:right;color:#374151;">${po.po_number}</td></tr>
        <tr><td style="color:#6B7280;padding:2px 0;">Fournisseur</td><td style="text-align:right;color:#374151;">${supplier?.name}</td></tr>
        <tr><td style="color:#6B7280;padding:2px 0;">Montant TTC</td><td style="text-align:right;color:#374151;">${Number(po.net_amount).toFixed(3)} TND</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;">
      Le bon de commande est annulé. Vous pouvez en créer un nouveau ou contacter <strong>${supplier?.name}</strong> pour négocier.
    </p>
  </div>
  <div style="padding:12px;text-align:center;font-size:11px;color:#9CA3AF;">
    Notification automatique — ${businessName}
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from:    `"${businessName}" <${this.from}>`,
        to:      recipients,
        subject: `✗ BC ${po.po_number} refusé par ${supplier?.name}`,
        html,
      });
      this.logger.log(`Email refus BC ${po.po_number} envoyé à : ${recipients}`);
    } catch (err: any) {
      this.logger.error(`Échec email refus BC : ${err.message}`);
    }
  }
}