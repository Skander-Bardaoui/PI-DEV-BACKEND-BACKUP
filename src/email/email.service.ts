// src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // Create the email transporter using Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('GMAIL_USER'),
        pass: this.configService.get<string>('GMAIL_PASS'),
      },
    });
  }

  // ─── Send Email Verification ─────────────────────────────────────────────
  async sendVerificationEmail(to: string, token: string, userName: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: 'Vérifiez votre adresse email - NovEntra',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">Bienvenue, ${userName}! 👋</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Merci de vous être inscrit sur NovEntra. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :
            </p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${verificationLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Vérifier mon email
              </a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Ou copiez et collez ce lien dans votre navigateur :<br>
              <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              Ce lien expirera dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
  }

  // ─── Send Password Reset Email ───────────────────────────────────────────
  async sendPasswordResetEmail(to: string, token: string, userName: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: 'Réinitialisation de votre mot de passe - NovEntra',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">Réinitialisation de mot de passe</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${userName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
            </p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetLink}" 
                 style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Ou copiez et collez ce lien dans votre navigateur :<br>
              <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              Ce lien expirera dans 1 heure. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe ne sera pas modifié.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${to}`);
  }

  // ─── Send Welcome Email (after verification) ────────────────────────────
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: 'Bienvenue sur NovEntra ! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">Bienvenue, ${userName}! 🎉</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre email a été vérifié avec succès. Vous êtes maintenant prêt à utiliser NovEntra pour gérer votre entreprise.
            </p>
            <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #333; margin-top: 0;">Prochaines étapes :</h3>
              <ul style="color: #666; line-height: 2;">
                <li>✅ Configurez votre profil d'entreprise</li>
                <li>📄 Créez votre première facture</li>
                <li>👥 Invitez les membres de votre équipe</li>
                <li>💰 Suivez vos dépenses et revenus</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}/app/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Accéder au tableau de bord
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Si vous avez des questions, n'hésitez pas à contacter notre équipe de support.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${to}`);
  }

  // ─── Send Payment Schedule Approval Email ───────────────────────────────
  async sendPaymentScheduleApprovalEmail(
    to: string,
    supplierName: string,
    invoiceNumber: string,
    totalAmount: number,
    installments: { installment_number: number; due_date: Date; amount: number }[],
    acceptUrl: string,
    rejectUrl: string,
  ): Promise<void> {
    const installmentRows = installments
      .map(
        (i) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151">
              Échéance #${i.installment_number}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151">
              ${new Date(i.due_date).toLocaleDateString('fr-TN')}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;
                       font-weight:600;color:#111827">
              ${Number(i.amount).toFixed(3)} TND
            </td>
          </tr>`,
      )
      .join('');

    const mailOptions = {
      from: `"SaaS Platform" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: `Proposition de paiement échelonné — Facture ${invoiceNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;
                    margin:0 auto;color:#1f2937">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);
                      padding:32px;border-radius:16px 16px 0 0">
            <h1 style="color:#fff;margin:0;font-size:22px">
              Proposition de paiement échelonné
            </h1>
            <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px">
              Facture ${invoiceNumber}
            </p>
          </div>

          <!-- Body -->
          <div style="background:#fff;padding:32px;
                      border:1px solid #e5e7eb;border-top:none;
                      border-radius:0 0 16px 16px">

            <p style="margin-top:0">
              Bonjour <strong>${supplierName}</strong>,
            </p>
            <p>
              Notre équipe vous propose un plan de paiement échelonné
              pour la facture <strong>${invoiceNumber}</strong>
              d'un montant total de
              <strong>${Number(totalAmount).toFixed(3)} TND</strong>.
            </p>

            <!-- Installments table -->
            <table style="width:100%;border-collapse:collapse;
                          margin:20px 0;border-radius:8px;
                          overflow:hidden;font-size:14px">
              <thead>
                <tr style="background:#4f46e5;color:#fff">
                  <th style="padding:10px 12px;text-align:left;
                             font-weight:600">
                    Échéance
                  </th>
                  <th style="padding:10px 12px;text-align:left;
                             font-weight:600">
                    Date
                  </th>
                  <th style="padding:10px 12px;text-align:left;
                             font-weight:600">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody style="background:#f9fafb">
                ${installmentRows}
              </tbody>
            </table>

            <p style="color:#6b7280;font-size:14px">
              Veuillez accepter ou refuser cette proposition
              en cliquant sur l'un des boutons ci-dessous.
            </p>

            <!-- CTA buttons — table layout for email client compatibility -->
            <table style="width:100%;margin-top:24px;
                          border-collapse:collapse">
              <tr>
                <td style="padding-right:8px">
                  <a href="${acceptUrl}"
                     style="display:block;text-align:center;
                            padding:14px 24px;background:#10b981;
                            color:#fff;text-decoration:none;
                            border-radius:10px;font-weight:600;
                            font-size:15px">
                    ✅ Accepter
                  </a>
                </td>
                <td style="padding-left:8px">
                  <a href="${rejectUrl}"
                     style="display:block;text-align:center;
                            padding:14px 24px;background:#ef4444;
                            color:#fff;text-decoration:none;
                            border-radius:10px;font-weight:600;
                            font-size:15px">
                    ❌ Refuser
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#9ca3af;font-size:12px;margin-top:24px">
              Ce lien est à usage unique et sécurisé.
              Si vous n'êtes pas concerné par ce message,
              ignorez cet email.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Payment schedule approval email sent to ${to}`);
  }

  // ─── Send Trial Expiry Warning Email ────────────────────────────────────
  async sendTrialExpiryWarning(to: string, userName: string, trialEndsAt: Date): Promise<void> {
    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: `⏰ Votre essai gratuit expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">⏰ Votre essai expire bientôt</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${userName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre essai gratuit de NovEntra expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> (le ${trialEndsAt.toLocaleDateString('fr-FR')}).
            </p>
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #92400e; margin-top: 0;">Ne perdez pas vos données !</h3>
              <p style="color: #92400e; margin-bottom: 0;">
                Choisissez un plan pour continuer à utiliser NovEntra et conserver tous vos clients, factures et données.
              </p>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}/app/settings/billing" 
                 style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                Choisir un plan
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Des questions ? Contactez notre équipe de support.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Trial expiry warning sent to ${to}`);
  }

  // ─── Send Payment Reminder Email ────────────────────────────────────────
  async sendPaymentReminder(to: string, userName: string, periodEnd: Date): Promise<void> {
    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: '💳 Paiement en retard - Action requise',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">💳 Paiement en retard</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${userName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre abonnement NovEntra est en retard de paiement depuis le ${periodEnd.toLocaleDateString('fr-FR')}. 
              Votre compte sera suspendu si le paiement n'est pas effectué rapidement.
            </p>
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #991b1b; margin-top: 0;">Action requise</h3>
              <p style="color: #991b1b; margin-bottom: 0;">
                Mettez à jour votre méthode de paiement pour éviter l'interruption de service.
              </p>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}/app/settings/billing" 
                 style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">
                Effectuer le paiement
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Besoin d'aide ? Contactez notre équipe de support.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Payment reminder sent to ${to}`);
  }

  // ─── Send Data Deletion Warning Email ───────────────────────────────────
  async sendDataDeletionWarning(to: string, userName: string, suspendedAt: Date): Promise<void> {
    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: '⚠️ URGENT: Suppression des données dans 7 jours',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #7c2d12 0%, #991b1b 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #7c2d12 0%, #991b1b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">⚠️ URGENT: Suppression des données</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${userName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre compte NovEntra est suspendu depuis le ${suspendedAt.toLocaleDateString('fr-FR')} (plus de 30 jours).
              <strong>Toutes vos données seront définitivement supprimées dans 7 jours</strong> si aucune action n'est entreprise.
            </p>
            <div style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); border-radius: 12px; padding: 20px; margin: 30px 0; color: white;">
              <h3 style="color: white; margin-top: 0;">⚠️ Dernière chance</h3>
              <p style="color: #fecaca; margin-bottom: 0;">
                Cette suppression est irréversible. Toutes vos factures, clients et données seront perdues à jamais.
              </p>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}/app/settings/billing" 
                 style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);">
                Sauver mes données
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Contactez immédiatement notre équipe de support si vous avez des questions.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Data deletion warning sent to ${to}`);
  }

  // ─── Send Tenant Rejection Email ────────────────────────────────────────
  async sendTenantRejectionEmail(to: string, userName: string, reason: string): Promise<void> {
    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: 'Votre demande d\'inscription a été refusée',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">Demande d'inscription refusée</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${userName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Nous regrettons de vous informer que votre demande d'inscription à NovEntra a été refusée.
            </p>
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #991b1b; margin-top: 0;">Raison du refus:</h3>
              <p style="color: #991b1b; margin-bottom: 0;">
                ${reason}
              </p>
            </div>
            <p style="color: #666; line-height: 1.6; margin-top: 30px;">
              Si vous pensez qu'il s'agit d'une erreur ou si vous avez des questions, n'hésitez pas à contacter notre équipe de support.
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Merci de votre compréhension.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Tenant rejection email sent to ${to}`);
  }

  // ─── Send Payment Submitted Notification (to Admin) ─────────────────────
  async sendPaymentSubmittedNotification(
    to: string,
    tenantName: string,
    planName: string,
    amount: number,
    method: string,
    payerName: string,
    payerPhone: string,
    referenceNumber?: string,
  ): Promise<void> {
    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: `💳 Nouveau paiement soumis - ${tenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">💳 Nouveau paiement soumis</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Un nouveau paiement a été soumis et nécessite votre vérification.
            </p>
            <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #333; margin-top: 0;">Détails du paiement:</h3>
              <table style="width: 100%; color: #666;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Tenant:</strong></td>
                  <td style="padding: 8px 0;">${tenantName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Plan:</strong></td>
                  <td style="padding: 8px 0;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Montant:</strong></td>
                  <td style="padding: 8px 0;">${Number(amount).toFixed(3)} TND</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Méthode:</strong></td>
                  <td style="padding: 8px 0;">${method}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Payeur:</strong></td>
                  <td style="padding: 8px 0;">${payerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Téléphone:</strong></td>
                  <td style="padding: 8px 0;">${payerPhone}</td>
                </tr>
                ${referenceNumber ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>Référence:</strong></td>
                  <td style="padding: 8px 0;">${referenceNumber}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}/console/subscriptions" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Vérifier le paiement
              </a>
            </div>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Payment submitted notification sent to ${to}`);
  }

  // ─── Send Payment Rejected Email (to Tenant) ─────────────────────────────
  async sendPaymentRejectedEmail(
    to: string,
    tenantName: string,
    reason: string,
    paymentToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const paymentLink = `${frontendUrl}/payment/${paymentToken}`;

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: '❌ Paiement refusé - Action requise',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">❌ Paiement refusé</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${tenantName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre paiement a été refusé pour la raison suivante :
            </p>
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #991b1b; margin-top: 0;">Raison du refus:</h3>
              <p style="color: #991b1b; margin-bottom: 0;">
                ${reason}
              </p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              Veuillez soumettre à nouveau vos informations de paiement en cliquant sur le bouton ci-dessous :
            </p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${paymentLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Soumettre à nouveau
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Des questions ? Contactez notre équipe de support.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Payment rejected email sent to ${to}`);
  }

  // ─── Send Tenant Approval Email (with Payment Link) ─────────────────────
  async sendTenantApprovalEmail(
    to: string,
    tenantName: string,
    planName: string,
    billingCycle: string,
    amount: number,
    paymentToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const paymentLink = `${frontendUrl}/pay/${paymentToken}`;

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: '✅ Votre compte a été approuvé - Complétez votre paiement',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">✅ Votre compte a été approuvé !</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${tenantName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Félicitations ! Votre demande d'inscription à NovEntra a été approuvée. Pour activer votre compte, veuillez compléter le paiement de votre abonnement.
            </p>
            <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #333; margin-top: 0;">Détails de votre abonnement:</h3>
              <table style="width: 100%; color: #666;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Plan:</strong></td>
                  <td style="padding: 8px 0;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Cycle de facturation:</strong></td>
                  <td style="padding: 8px 0;">${billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Montant:</strong></td>
                  <td style="padding: 8px 0;"><strong>${Number(amount).toFixed(3)} TND</strong></td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${paymentLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Compléter le paiement
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Ce lien est sécurisé et unique à votre compte.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Tenant approval email sent to ${to}`);
  }

  // ─── Send Subscription Activated Email ──────────────────────────────────
  async sendSubscriptionActivatedEmail(
    to: string,
    ownerName: string,
    planName: string,
    billingCycle: string,
    amount: number,
    nextBillingDate: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const loginLink = `${frontendUrl}/login`;

    const mailOptions = {
      from: `"NovEntra" <${this.configService.get<string>('GMAIL_USER')}>`,
      to,
      subject: 'NovEntra — Votre abonnement est activé ✅',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">NovEntra</h1>
            </div>
            <h2 style="color: #333; margin-bottom: 20px;">✅ Votre abonnement est activé !</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${ownerName},</p>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Votre paiement a été reçu et votre abonnement est maintenant actif. Vous pouvez dès maintenant accéder à votre compte NovEntra.
            </p>
            <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #333; margin-top: 0;">Détails de votre abonnement:</h3>
              <table style="width: 100%; color: #666;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Plan:</strong></td>
                  <td style="padding: 8px 0;">${planName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Cycle:</strong></td>
                  <td style="padding: 8px 0;">${billingCycle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Montant payé:</strong></td>
                  <td style="padding: 8px 0;"><strong>${Number(amount).toFixed(3)} TND</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Prochaine facturation:</strong></td>
                  <td style="padding: 8px 0;">${nextBillingDate}</td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${loginLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Accéder à mon compte
              </a>
            </div>
            <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              Merci de votre confiance. Si vous avez des questions, n'hésitez pas à nous contacter.
            </p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`Subscription activated email sent to ${to}`);
  }
}

