// src/sales/services/client-onboarding.service.ts

import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Client } from '../entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';

export interface InviteClientDto {
  email: string;
  name?: string;
}

export interface CompleteClientOnboardingDto {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  billing_details?: string;
}

@Injectable()
export class ClientOnboardingService {
  private readonly logger = new Logger(ClientOnboardingService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.from = config.get<string>('GMAIL_USER', 'no-reply@platform.tn');
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.get<string>('GMAIL_USER'),
        pass: config.get<string>('GMAIL_PASS'),
      },
    });
  }

  /**
   * Étape 1 : Le business owner envoie une invitation par email
   */
  async inviteClient(businessId: string, dto: InviteClientDto): Promise<{ message: string; token: string; invitationLink: string }> {
    // Vérifier que le business existe
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business introuvable');
    }

    const businessName = (business as any)?.name ?? 'Votre fournisseur';
    const businessEmail = (business as any)?.email ?? this.from;

    // Vérifier si le client existe déjà
    const existing = await this.clientRepo.findOne({
      where: { business_id: businessId, email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Ce client existe déjà dans votre base');
    }

    // Générer un token JWT avec businessId + email
    const secret = this.config.get<string>('JWT_CLIENT_ONBOARDING_SECRET', 'client_onboarding_secret_change_me');
    const token = this.jwtService.sign(
      { businessId, email: dto.email, name: dto.name },
      { secret, expiresIn: '7d' },
    );

    // Construire le lien d'invitation
    const invitationLink = `${this.frontendUrl}/client-onboarding/${token}`;

    this.logger.log(`Invitation client générée pour ${dto.email} — lien: ${invitationLink}`);

    // Envoyer l'email d'invitation
    const html = this.buildInvitationEmail(businessName, dto.name, invitationLink);

    try {
      const mailOptions = {
        from: `"${businessName}" <${this.from}>`,
        to: dto.email,
        replyTo: businessEmail,
        subject: `Invitation client — ${businessName} vous invite`,
        html,
        attachments: [
          {
            filename: 'logo.png',
            path: './public/logo.png',
            cid: 'logo@novaentra',
          },
        ],
      };

      this.logger.log(`Envoi email de ${mailOptions.from} vers ${mailOptions.to}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email envoyé avec succès! MessageId: ${info.messageId}`);
      this.logger.log(`Réponse du serveur: ${info.response}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi invitation : ${err.message}`);
      this.logger.error(`Stack: ${err.stack}`);
      throw new BadRequestException('Impossible d\'envoyer l\'email. Vérifiez la configuration SMTP.');
    }

    return {
      message: `Invitation envoyée à ${dto.email}`,
      token,
      invitationLink,
    };
  }

  /**
   * Étape 2 : Le client accède au lien et récupère les infos pré-remplies
   */
  async getInvitationDetails(token: string): Promise<{ email: string; name?: string; businessName: string }> {
    try {
      const secret = this.config.get<string>('JWT_CLIENT_ONBOARDING_SECRET', 'client_onboarding_secret_change_me');
      const payload = this.jwtService.verify(token, { secret });

      const business = await this.businessRepo.findOne({ where: { id: payload.businessId } });
      if (!business) {
        throw new NotFoundException('Business introuvable');
      }

      return {
        email: payload.email,
        name: payload.name,
        businessName: business.name,
      };
    } catch (err: any) {
      this.logger.error(`Token invalide ou expiré: ${err.message}`);
      throw new BadRequestException('Lien d\'invitation invalide ou expiré');
    }
  }

  /**
   * Étape 3 : Le client soumet sa fiche complétée
   */
  async completeOnboarding(token: string, dto: CompleteClientOnboardingDto): Promise<Client> {
    try {
      const secret = this.config.get<string>('JWT_CLIENT_ONBOARDING_SECRET', 'client_onboarding_secret_change_me');
      const payload = this.jwtService.verify(token, { secret });

      // Vérifier que l'email correspond
      if (dto.email !== payload.email) {
        throw new BadRequestException('L\'email ne correspond pas à l\'invitation');
      }

      // Vérifier que le client n'existe pas déjà
      const existing = await this.clientRepo.findOne({
        where: { business_id: payload.businessId, email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('Ce client existe déjà');
      }

      // Créer le client
      const client = this.clientRepo.create({
        business_id: payload.businessId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        payment_terms: dto.payment_terms,
        billing_details: dto.billing_details,
      });

      await this.clientRepo.save(client);

      this.logger.log(`Client ${dto.name} créé avec succès via onboarding`);

      return client;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Erreur lors de l'onboarding: ${err.message}`);
      throw new BadRequestException('Lien d\'invitation invalide ou expiré');
    }
  }

  /**
   * Build HTML email template for client invitation
   */
  private buildInvitationEmail(businessName: string, clientName: string | undefined, inviteUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      margin: 0; 
      padding: 0; 
      background-color: #F3F4F6;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #F3F4F6;
    }
    .btn { 
      display: inline-block; 
      padding: 16px 40px; 
      background-color: #4F46E5; 
      color: #ffffff !important; 
      text-decoration: none; 
      border-radius: 10px; 
      font-size: 16px; 
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6;">
  <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 32px; border-radius: 16px 16px 0 0; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);">
      <div style="text-align: center;">
        <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.95); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; padding: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
          <img src="cid:logo@novaentra" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">${businessName}</h1>
        <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">vous invite à créer votre fiche client</p>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: #ffffff; padding: 36px 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

      <!-- Greeting -->
      <p style="font-size: 16px; color: #1F2937; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour${clientName ? ` <strong style="color: #4F46E5;">${clientName}</strong>` : ''},
      </p>

      <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">
        <strong style="color: #1F2937;">${businessName}</strong> vous invite à créer votre fiche client sur leur plateforme.
      </p>

      <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 32px 0;">
        <strong>C'est simple et rapide :</strong> cliquez sur le bouton ci-dessous et remplissez votre fiche en quelques minutes.
      </p>

      <!-- Steps -->
      <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border: 2px solid #C7D2FE; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 700; color: #1E1B4B; text-align: center;">
          🚀 Comment ça marche
        </p>
        
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td align="center" style="width: 60px; vertical-align: top; padding-top: 4px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #4F46E5; color: #ffffff; font-size: 18px; font-weight: 700; display: inline-block; line-height: 44px; text-align: center; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">1</div>
            </td>
            <td style="vertical-align: top; padding-top: 8px;">
              <p style="margin: 0; font-size: 15px; color: #1F2937; line-height: 1.6;">
                Cliquez sur le bouton et remplissez votre fiche<br>
                <strong style="color: #4F46E5;">(5 minutes)</strong>
              </p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td align="center" style="width: 60px; vertical-align: top; padding-top: 4px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #4F46E5; color: #ffffff; font-size: 18px; font-weight: 700; display: inline-block; line-height: 44px; text-align: center; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">2</div>
            </td>
            <td style="vertical-align: top; padding-top: 8px;">
              <p style="margin: 0; font-size: 15px; color: #1F2937; line-height: 1.6;">
                Votre fiche est <strong style="color: #4F46E5;">validée automatiquement</strong>
              </p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="width: 60px; vertical-align: top; padding-top: 4px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #16A34A; color: #ffffff; font-size: 20px; font-weight: 700; display: inline-block; line-height: 44px; text-align: center; box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);">✓</div>
            </td>
            <td style="vertical-align: top; padding-top: 8px;">
              <p style="margin: 0; font-size: 15px; color: #1F2937; line-height: 1.6;">
                <strong style="color: #16A34A;">${businessName}</strong> peut vous envoyer des devis et factures
              </p>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteUrl}" class="btn" style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
          Créer ma fiche client →
        </a>
        <p style="margin: 14px 0 0 0; font-size: 12px; color: #6B7280; font-weight: 500;">
          🔒 Lien sécurisé valable 7 jours
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 16px;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280; line-height: 1.6;">
        Si vous n'êtes pas concerné par cette invitation, ignorez cet email.
      </p>
      <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
        Invitation envoyée par <strong>${businessName}</strong> via NovaEntra
      </p>
    </div>

  </div>
</body>
</html>`;
  }
}
