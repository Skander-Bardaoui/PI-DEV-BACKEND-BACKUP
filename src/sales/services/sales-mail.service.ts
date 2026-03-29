// src/sales/services/sales-mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { Invoice } from '../entities/invoice.entity';
import { Quote } from '../entities/quote.entity';
import { SalesOrder } from '../entities/sales-order.entity';
import { DeliveryNote } from '../entities/delivery-note.entity';

@Injectable()
export class SalesMailService {
  private readonly logger = new Logger(SalesMailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('GMAIL_USER'),
        pass: this.configService.get<string>('GMAIL_PASS'),
      },
    });
  }

  // ─── Send Invoice Email (with AI support) ───────────────────────────────
  async sendInvoiceEmail(
    invoice: Invoice,
    recipientEmail: string,
    customSubject?: string,
    customBody?: string,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    this.logger.log(`Sending invoice email - Custom subject: ${customSubject ? 'YES' : 'NO'}, Custom body: ${customBody ? 'YES' : 'NO'}`);

    const attachments: any[] = [
      {
        filename: 'logo.png',
        path: path.join(process.cwd(), 'public', 'logo.png'),
        cid: 'company-logo',
      },
    ];

    if (pdfBuffer && pdfBuffer.length > 0) {
      attachments.push({
        filename: `Facture_${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    const subject = customSubject || `Facture ${invoice.invoice_number} - ${invoice.business?.name || 'Votre Entreprise'}`;
    const htmlBody = customBody
      ? this.getCustomEmailTemplate(customBody, invoice)
      : this.getInvoiceEmailTemplate(invoice);

    const mailOptions = {
      from: `"${invoice.business?.name || 'Votre Entreprise'}" <${this.configService.get<string>('GMAIL_USER')}>`,
      to: recipientEmail,
      subject,
      html: htmlBody,
      attachments,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Facture ${invoice.invoice_number} envoyée à ${recipientEmail}`);
  }

  // ─── Send Quote Email ────────────────────────────────────────────────────
  async sendQuoteEmail(
    quote: Quote,
    recipientEmail: string,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    const attachments: any[] = [
      {
        filename: 'logo.png',
        path: path.join(process.cwd(), 'public', 'logo.png'),
        cid: 'company-logo',
      },
    ];

    if (pdfBuffer) {
      attachments.push({
        filename: `Devis_${quote.quoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    const mailOptions = {
      from: `"${quote.business?.name || 'Votre Entreprise'}" <${this.configService.get<string>('GMAIL_USER')}>`,
      to: recipientEmail,
      subject: `Devis ${quote.quoteNumber} - ${quote.business?.name || 'Votre Entreprise'}`,
      html: this.getQuoteEmailTemplate(quote),
      attachments,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Devis ${quote.quoteNumber} envoyé à ${recipientEmail}`);
  }

  // ─── Send Sales Order Confirmation ───────────────────────────────────────
  async sendSalesOrderEmail(
    order: SalesOrder,
    recipientEmail: string,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    const mailOptions = {
      from: `"${order.business?.name || 'Votre Entreprise'}" <${this.configService.get<string>('GMAIL_USER')}>`,
      to: recipientEmail,
      subject: `Commande ${order.orderNumber} confirmée - ${order.business?.name || 'Votre Entreprise'}`,
      html: this.getSalesOrderEmailTemplate(order),
      attachments: pdfBuffer ? [{
        filename: `Commande_${order.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : [],
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Commande ${order.orderNumber} envoyée à ${recipientEmail}`);
  }

  // ─── Send Sales Order with Portal Link ──────────────────────────────────
  async sendSalesOrderEmailWithPortal(
    order: SalesOrder,
    recipientEmail: string,
    portalToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const portalUrl = `${frontendUrl}/client-portal?token=${portalToken}`;
    const businessName = order.business?.name || 'Votre Entreprise';
    const businessEmail = order.business?.email || this.configService.get<string>('GMAIL_USER');
    const businessPhone = order.business?.phone || '';
    const businessMF = order.business?.tax_id || '';

    const itemsHtml = (order.items ?? []).map(item => {
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;">${item.description}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">${Number(item.quantity).toFixed(3)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">${Number(item.unitPrice).toFixed(3)} TND</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${Number(item.taxRate)}%</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:600;">${lineTotal.toFixed(3)} TND</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;background:#f5f5f5;padding:20px;"><div style="background:#F5576C;padding:24px 32px;border-radius:8px 8px 0 0;"><table style="width:100%;"><tr><td><h1 style="color:#fff;margin:0;font-size:20px;">${businessName}</h1>${businessMF ? `<p style="color:#FFC1CB;margin:3px 0 0;font-size:12px;">MF : ${businessMF}</p>` : ''}${businessEmail ? `<p style="color:#FFC1CB;margin:2px 0 0;font-size:12px;">${businessEmail}</p>` : ''}${businessPhone ? `<p style="color:#FFC1CB;margin:2px 0 0;font-size:12px;">${businessPhone}</p>` : ''}</td><td style="text-align:right;vertical-align:top;"><p style="color:#FFC1CB;margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Commande</p><p style="color:#fff;margin:4px 0 0;font-size:22px;font-weight:700;">${order.orderNumber}</p><p style="color:#FFC1CB;margin:4px 0 0;font-size:12px;">Le ${new Date().toLocaleDateString('fr-TN', { day: '2-digit', month: 'long', year: 'numeric' })}</p></td></tr></table></div><div style="background:#fff;padding:24px 32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;"><table style="width:100%;margin-bottom:20px;"><tr><td style="width:48%;vertical-align:top;padding:12px;background:#F9FAFB;border-radius:8px;"><p style="font-size:11px;color:#9CA3AF;text-transform:uppercase;margin:0 0 6px;letter-spacing:.05em;">De</p><p style="font-weight:700;margin:0;font-size:14px;color:#111;">${businessName}</p>${businessEmail ? `<p style="margin:3px 0 0;font-size:13px;color:#555;">${businessEmail}</p>` : ''}${businessPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#555;">${businessPhone}</p>` : ''}</td><td style="width:4%;"></td><td style="width:48%;vertical-align:top;padding:12px;background:#F9FAFB;border-radius:8px;"><p style="font-size:11px;color:#9CA3AF;text-transform:uppercase;margin:0 0 6px;letter-spacing:.05em;">À</p><p style="font-weight:700;margin:0;font-size:14px;color:#111;">${order.client?.name}</p>${order.client?.email ? `<p style="margin:3px 0 0;font-size:13px;color:#555;">${order.client.email}</p>` : ''}${order.client?.phone ? `<p style="margin:2px 0 0;font-size:13px;color:#555;">${order.client.phone}</p>` : ''}</td></tr></table><p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#444;">Bonjour <strong>${order.client?.name}</strong>,<br><br>Nous avons le plaisir de vous confirmer votre commande <strong>${order.orderNumber}</strong>. Veuillez en prendre connaissance et nous confirmer votre accord via le bouton ci-dessous.</p><table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;"><thead><tr style="background:#F3F4F6;"><th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;">Description</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">Qté</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">P.U. HT</th><th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;font-weight:600;">TVA</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;">Total HT</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="text-align:right;margin-bottom:24px;"><table style="margin-left:auto;min-width:280px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;"><tr style="background:#F9FAFB;"><td style="padding:8px 16px;color:#6B7280;font-size:13px;">Sous-total HT</td><td style="padding:8px 16px;text-align:right;font-size:13px;">${Number(order.subtotal).toFixed(3)} TND</td></tr><tr><td style="padding:8px 16px;color:#6B7280;font-size:13px;">TVA</td><td style="padding:8px 16px;text-align:right;font-size:13px;">${Number(order.taxAmount).toFixed(3)} TND</td></tr><tr style="background:#F9FAFB;"><td style="padding:8px 16px;color:#6B7280;font-size:13px;">Timbre fiscal</td><td style="padding:8px 16px;text-align:right;font-size:13px;">1,000 TND</td></tr><tr style="background:#FEF2F4;"><td style="padding:10px 16px;font-size:15px;font-weight:700;color:#BE123C;">Net TTC</td><td style="padding:10px 16px;text-align:right;font-size:15px;font-weight:700;color:#BE123C;">${Number(order.netAmount).toFixed(3)} TND</td></tr></table></div>${order.notes ? `<div style="padding:12px 16px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;margin-bottom:24px;"><p style="margin:0;font-size:13px;color:#92400E;"><strong>Notes :</strong> ${order.notes}</p></div>` : ''}<div style="text-align:center;padding:24px;background:#FFF1F2;border-radius:12px;border:1px solid #FECDD3;margin-bottom:20px;"><p style="margin:0 0 8px;font-size:14px;color:#BE123C;font-weight:600;">Confirmez ou refusez cette commande en un clic</p><p style="margin:0 0 16px;font-size:12px;color:#6B7280;">Accédez à votre portail sécurisé pour confirmer votre accord.</p><a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#F5576C;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:.02em;">Accéder à mon portail client →</a><p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">Ce lien est valable 72 heures et est uniquement destiné à ${order.client?.name}.</p></div><div style="padding:12px 14px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;margin-top:12px;font-size:12px;color:#166534;"><p style="margin:0;font-weight:600;margin-bottom:4px;">Contact</p><p style="margin:0;">Pour toute question, contactez <strong>${businessName}</strong> :</p>${businessEmail ? `<p style="margin:4px 0 0;"><a href="mailto:${businessEmail}" style="color:#166534;font-weight:600;">${businessEmail}</a></p>` : ''}${businessPhone ? `<p style="margin:2px 0 0;">Tél : ${businessPhone}</p>` : ''}</div></div><div style="padding:16px 32px;background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#9CA3AF;text-align:center;">Cet email a été envoyé automatiquement par ${businessName}. Si vous n'êtes pas le destinataire prévu, veuillez ignorer ce message.</div></body></html>`;

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.configService.get<string>('GMAIL_USER')}>`,
        to: recipientEmail,
        subject: `Commande ${order.orderNumber} — Confirmation requise — ${businessName}`,
        html,
      });
      this.logger.log(`Email commande ${order.orderNumber} avec portail envoyé à ${recipientEmail}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi email commande ${order.orderNumber} : ${err.message}`);
    }
  }

  // ─── Send Delivery Note ──────────────────────────────────────────────────
  async sendDeliveryNoteEmail(
    deliveryNote: DeliveryNote,
    recipientEmail: string,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    const mailOptions = {
      from: `"${deliveryNote.business?.name || 'Votre Entreprise'}" <${this.configService.get<string>('GMAIL_USER')}>`,
      to: recipientEmail,
      subject: `Bon de livraison ${deliveryNote.deliveryNoteNumber} - ${deliveryNote.business?.name || 'Votre Entreprise'}`,
      html: this.getDeliveryNoteEmailTemplate(deliveryNote),
      attachments: pdfBuffer ? [{
        filename: `BL_${deliveryNote.deliveryNoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : [],
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Bon de livraison ${deliveryNote.deliveryNoteNumber} envoyé à ${recipientEmail}`);
  }

  // ─── Send Payment Reminder ───────────────────────────────────────────────
  async sendPaymentReminder(invoice: Invoice, recipientEmail: string): Promise<void> {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );

    const mailOptions = {
      from: `"${invoice.business?.name || 'Votre Entreprise'}" <${this.configService.get<string>('GMAIL_USER')}>`,
      to: recipientEmail,
      subject: `Rappel de paiement - Facture ${invoice.invoice_number}`,
      html: this.getPaymentReminderTemplate(invoice, daysOverdue),
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(process.cwd(), 'public', 'logo.png'),
          cid: 'company-logo',
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Rappel de paiement envoyé pour facture ${invoice.invoice_number}`);
  }

  // ─── Email Templates ─────────────────────────────────────────────────────

  private getInvoiceEmailTemplate(invoice: Invoice): string {
    const itemsHtml = invoice.items?.map(item => `
      <tr style="border-bottom: 1px solid #e9ecef;">
        <td style="padding: 12px 8px; text-align: left;">${item.description || 'Article'}</td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; text-align: right;">${Number(item.unit_price || 0).toFixed(3)} TND</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 600;">${Number(item.line_total_ttc || 0).toFixed(3)} TND</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #999;">Aucun article</td></tr>';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <img src="cid:company-logo" alt="Logo" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: white; margin: 0; font-size: 28px;">Facture</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${invoice.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Bonjour <strong>${invoice.client?.name || 'Client'}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Veuillez trouver ci-dessous le détail de votre facture <strong>${invoice.invoice_number}</strong>.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de facture:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(invoice.date).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date d'échéance:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(invoice.due_date).toLocaleDateString('fr-FR')}</td>
              </tr>
            </table>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Détail des articles</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                  <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #495057;">Description</th>
                  <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #495057;">Qté</th>
                  <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #495057;">P.U.</th>
                  <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #495057;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Total HT:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${Number(invoice.subtotal_ht || 0).toFixed(3)} TND</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">TVA:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${Number(invoice.tax_amount || 0).toFixed(3)} TND</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Timbre fiscal:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${Number(invoice.timbre_fiscal || 0).toFixed(3)} TND</td>
              </tr>
              <tr style="border-top: 2px solid #e9ecef;">
                <td style="padding: 12px 0; color: #666; font-size: 16px;">Montant total:</td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #667eea;">
                  ${Number(invoice.net_amount).toFixed(3)} TND
                </td>
              </tr>
            </table>
          </div>
          
          ${invoice.notes ? `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Note:</strong> ${invoice.notes}
              </p>
            </div>
          ` : ''}
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Pour toute question, n'hésitez pas à nous contacter.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Cordialement,<br>
            <strong>${invoice.business?.name || 'Votre Entreprise'}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }

  private getQuoteEmailTemplate(quote: Quote): string {
    const validUntil = new Date(quote.validUntil).toLocaleDateString('fr-FR');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <img src="cid:company-logo" alt="Logo" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: white; margin: 0; font-size: 28px;">Devis</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${quote.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Bonjour <strong>${quote.client?.name || 'Client'}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Nous avons le plaisir de vous transmettre notre devis <strong>${quote.quoteNumber}</strong>.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #11998e;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de devis:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${quote.quoteNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(quote.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Valide jusqu'au:</td>
                <td style="padding: 8px 0; text-align: right;">${validUntil}</td>
              </tr>
              <tr style="border-top: 2px solid #e9ecef;">
                <td style="padding: 12px 0; color: #666; font-size: 16px;">Montant total:</td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #11998e;">
                  ${Number(quote.netAmount).toFixed(3)} TND
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              ⏰ Ce devis est valable jusqu'au <strong>${validUntil}</strong>
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            N'hésitez pas à nous contacter pour toute question ou modification.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Cordialement,<br>
            <strong>${quote.business?.name || 'Votre Entreprise'}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }

  private getSalesOrderEmailTemplate(order: SalesOrder): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✓ Commande Confirmée</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${order.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Bonjour <strong>${order.client?.name || 'Client'}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Votre commande <strong>${order.orderNumber}</strong> a été confirmée avec succès.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de commande:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${order.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Statut:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                    ${order.status}
                  </span>
                </td>
              </tr>
              <tr style="border-top: 2px solid #e9ecef;">
                <td style="padding: 12px 0; color: #666; font-size: 16px;">Montant total:</td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #f5576c;">
                  ${Number(order.netAmount).toFixed(3)} TND
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724; font-size: 14px;">
              ✓ Votre commande est en cours de traitement et sera livrée dans les meilleurs délais.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Vous recevrez une notification dès l'expédition de votre commande.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Cordialement,<br>
            <strong>${order.business?.name || 'Votre Entreprise'}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }

  private getDeliveryNoteEmailTemplate(deliveryNote: DeliveryNote): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📦 Bon de Livraison</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${deliveryNote.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Bonjour <strong>${deliveryNote.client?.name || 'Client'}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Votre livraison <strong>${deliveryNote.deliveryNoteNumber}</strong> est en route.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4facfe;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de BL:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${deliveryNote.deliveryNoteNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date de livraison:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(deliveryNote.deliveryDate).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Statut:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background: #17a2b8; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                    ${deliveryNote.status}
                  </span>
                </td>
              </tr>
            </table>
          </div>
          
          ${deliveryNote.notes ? `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Note:</strong> ${deliveryNote.notes}
              </p>
            </div>
          ` : ''}
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Merci de vérifier les articles à la réception et de signer le bon de livraison.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Cordialement,<br>
            <strong>${deliveryNote.business?.name || 'Votre Entreprise'}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }

  private getPaymentReminderTemplate(invoice: Invoice, daysOverdue: number): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f12711 0%, #f5af19 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <img src="cid:company-logo" alt="Logo" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Rappel de Paiement</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${invoice.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Bonjour <strong>${invoice.client?.name || 'Client'}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Nous vous rappelons que la facture <strong>${invoice.invoice_number}</strong> est en attente de paiement.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f12711;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de facture:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date d'échéance:</td>
                <td style="padding: 8px 0; text-align: right; color: #dc3545; font-weight: bold;">
                  ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Jours de retard:</td>
                <td style="padding: 8px 0; text-align: right; color: #dc3545; font-weight: bold;">
                  ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}
                </td>
              </tr>
              <tr style="border-top: 2px solid #e9ecef;">
                <td style="padding: 12px 0; color: #666; font-size: 16px;">Montant dû:</td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #dc3545;">
                  ${Number(invoice.net_amount).toFixed(3)} TND
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; color: #721c24; font-size: 14px;">
              ⚠️ Merci de régulariser votre situation dans les plus brefs délais pour éviter toute pénalité.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Pour toute question concernant cette facture, n'hésitez pas à nous contacter.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Cordialement,<br>
            <strong>${invoice.business?.name || 'Votre Entreprise'}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }

  // ─── Custom Email Template (AI-generated content) ────────────────────────
  private getCustomEmailTemplate(customBody: string, invoice: Invoice): string {
    const formattedBody = customBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p style="font-size: 14px; color: #333; line-height: 1.6; margin: 10px 0;">${line}</p>`)
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <img src="cid:company-logo" alt="Logo" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: white; margin: 0; font-size: 28px;">Facture</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${invoice.business?.name || 'Votre Entreprise'}
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          ${formattedBody}
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Numéro de facture:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Montant:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #667eea; font-size: 18px;">
                  ${Number(invoice.net_amount || 0).toFixed(3)} TND
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date d'échéance:</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(invoice.due_date).toLocaleDateString('fr-FR')}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `;
  }
}