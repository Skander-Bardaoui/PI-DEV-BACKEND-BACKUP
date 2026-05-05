// src/sales/services/recurring-subscription-mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { RecurringInvoice, RecurringFrequency } from '../entities/recurring-invoice.entity';
import { Invoice } from '../entities/invoice.entity';
import { RecurringSubscriptionToken } from '../entities/recurring-subscription-token.entity';

const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  [RecurringFrequency.DAILY]: 'Quotidien',
  [RecurringFrequency.WEEKLY]: 'Hebdomadaire',
  [RecurringFrequency.MONTHLY]: 'Mensuel',
  [RecurringFrequency.QUARTERLY]: 'Trimestriel',
  [RecurringFrequency.YEARLY]: 'Annuel',
};

@Injectable()
export class RecurringSubscriptionMailService {
  private readonly logger = new Logger(RecurringSubscriptionMailService.name);

  constructor(
    @InjectRepository(RecurringSubscriptionToken)
    private readonly tokenRepo: Repository<RecurringSubscriptionToken>,
  ) {}

  async sendRecurringInvoiceEmail(
    recurring: RecurringInvoice,
    invoice: Invoice,
  ): Promise<void> {
    // Generate tokens for continue/cancel actions
    const continueToken = await this.generateToken(recurring, invoice, 'continue');
    const cancelToken = await this.generateToken(recurring, invoice, 'cancel');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const continueUrl = `${frontendUrl}/subscription-manage?token=${continueToken}&action=continue`;
    const cancelUrl = `${frontendUrl}/subscription-manage?token=${cancelToken}&action=cancel`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const clientEmail = recurring.client?.email;
    if (!clientEmail) {
      this.logger.warn(`No email found for client ${recurring.client_id}`);
      return;
    }

    const businessName = recurring.business?.name || 'Votre Entreprise';
    const invoiceDate = new Date(invoice.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const nextInvoiceDate = new Date(recurring.next_invoice_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre facture d'abonnement</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:28px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#4F46E5;border-radius:12px 12px 0 0;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">
                📄 Nouvelle facture d'abonnement
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">
                ${businessName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.6;">
                Bonjour <strong>${recurring.client?.name}</strong>,
              </p>
              
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Votre facture d'abonnement pour <strong>${recurring.description}</strong> a été générée.
              </p>

              <!-- Invoice Details Card -->
              <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#6B7280;font-size:14px;">Numéro de facture</span>
                    </td>
                    <td style="padding:8px 0;text-align:right;">
                      <strong style="color:#111827;font-size:14px;">${invoice.invoice_number}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#6B7280;font-size:14px;">Date</span>
                    </td>
                    <td style="padding:8px 0;text-align:right;">
                      <strong style="color:#111827;font-size:14px;">${invoiceDate}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#6B7280;font-size:14px;">Montant</span>
                    </td>
                    <td style="padding:8px 0;text-align:right;">
                      <strong style="color:#4F46E5;font-size:18px;">${Number(invoice.total_ttc).toFixed(3)} TND</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#6B7280;font-size:14px;">Fréquence</span>
                    </td>
                    <td style="padding:8px 0;text-align:right;">
                      <span style="background:#EEF2FF;color:#4F46E5;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">
                        ${RECURRING_FREQUENCY_LABELS[recurring.frequency]}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Next Invoice Info -->
              <div style="background:#DBEAFE;border-left:4px solid #3B82F6;padding:16px;border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;color:#1E40AF;font-size:14px;">
                  <strong>📅 Prochaine facture :</strong> ${nextInvoiceDate}
                </p>
              </div>

              <!-- Subscription Management -->
              <div style="border-top:2px solid #E5E7EB;padding-top:24px;margin-top:24px;">
                <h2 style="margin:0 0 16px;font-size:18px;color:#111827;font-weight:700;">
                  Gérer votre abonnement
                </h2>
                <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.6;">
                  Vous pouvez continuer votre abonnement ou l'arrêter à tout moment :
                </p>

                <!-- Action Buttons -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                  <tr>
                    <td style="padding:8px;">
                      <a href="${continueUrl}" 
                         style="display:block;background:#10B981;color:#ffffff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                        ✅ Continuer l'abonnement
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px;">
                      <a href="${cancelUrl}" 
                         style="display:block;background:#EF4444;color:#ffffff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                        ❌ Arrêter l'abonnement
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                  💡 Si vous ne faites rien, votre abonnement continuera automatiquement et la prochaine facture sera générée le ${nextInvoiceDate}.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-radius:0 0 12px 12px;padding:24px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">
                Besoin d'aide ? Contactez-nous
              </p>
              <p style="margin:0;font-size:14px;color:#4F46E5;font-weight:600;">
                ${recurring.business?.email || 'support@example.com'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.SMTP_USER}>`,
      to: clientEmail,
      subject: `📄 Votre facture d'abonnement ${invoice.invoice_number}`,
      html,
    });

    this.logger.log(`Subscription email sent to ${clientEmail} for invoice ${invoice.invoice_number}`);
  }

  private async generateToken(
    recurring: RecurringInvoice,
    invoice: Invoice,
    action: 'continue' | 'cancel',
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Valid for 30 days

    const subscriptionToken = this.tokenRepo.create({
      token,
      recurring_invoice_id: recurring.id,
      invoice_id: invoice.id,
      business_id: recurring.business_id,
      client_id: recurring.client_id,
      expires_at: expiresAt,
      used: false,
      action,
    });

    await this.tokenRepo.save(subscriptionToken);
    return token;
  }
}
