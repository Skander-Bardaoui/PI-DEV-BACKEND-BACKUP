// src/Purchases/services/supplier-onboarding.service.ts
import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import { JwtService }       from '@nestjs/jwt';
import * as nodemailer      from 'nodemailer';
import { Supplier }         from '../entities/supplier.entity';
import { Business }         from '../../businesses/entities/business.entity';

@Injectable()
export class SupplierOnboardingService {

  private readonly logger      = new Logger(SupplierOnboardingService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from:        string;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    private readonly config:     ConfigService,
    private readonly jwtService: JwtService,
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

  // ─── Envoyer une invitation ────────────────────────────────────────────────
  async sendInvitation(
    businessId: string,
    email:      string,
    name?:      string,
  ): Promise<{ message: string; token: string }> {

    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business introuvable.');

    const b            = business as any;
    const businessName = b?.name ?? 'Votre client';
    const businessEmail = b?.email ?? this.from;

    // Vérifier que ce fournisseur n'existe pas déjà
    const existing = await this.supplierRepo.findOne({
      where: { business_id: businessId, email },
    });
    if (existing) {
      throw new BadRequestException(
        `Un fournisseur avec l'email ${email} existe déjà dans votre système.`,
      );
    }

    // Générer un JWT signé (72h) comme token d'invitation
    const token = this.jwtService.sign(
      { business_id: businessId, email, name: name ?? null, type: 'supplier_invite' },
      { secret: this.config.get('JWT_PORTAL_SECRET', 'portal_secret'), expiresIn: '72h' },
    );

    const inviteUrl = `${this.frontendUrl}/supplier-register?token=${token}`;

    const html = `
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
    .step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #4F46E5;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .step-number.success {
      background-color: #16A34A;
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
        <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">vous invite à rejoindre sa plateforme</p>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: #ffffff; padding: 36px 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

      <!-- Greeting -->
      <p style="font-size: 16px; color: #1F2937; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour${name ? ` <strong style="color: #4F46E5;">${name}</strong>` : ''},
      </p>

      <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">
        <strong style="color: #1F2937;">${businessName}</strong> vous invite à créer votre fiche fournisseur sur leur plateforme de gestion des achats.
      </p>

      <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 32px 0;">
        <strong>C'est simple et rapide :</strong> cliquez sur le bouton ci-dessous et remplissez votre fiche en quelques minutes. Aucun compte à créer.
      </p>

      <!-- Steps -->
      <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border: 2px solid #C7D2FE; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 700; color: #1E1B4B; text-align: center;">
          🚀 Comment ça marche
        </p>
        
        <!-- Step 1 -->
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

        <!-- Step 2 -->
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

        <!-- Step 3 -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="width: 60px; vertical-align: top; padding-top: 4px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #16A34A; color: #ffffff; font-size: 20px; font-weight: 700; display: inline-block; line-height: 44px; text-align: center; box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);">✓</div>
            </td>
            <td style="vertical-align: top; padding-top: 8px;">
              <p style="margin: 0; font-size: 15px; color: #1F2937; line-height: 1.6;">
                <strong style="color: #16A34A;">${businessName}</strong> peut vous envoyer des commandes
              </p>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteUrl}" class="btn" style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
          Créer ma fiche fournisseur →
        </a>
        <p style="margin: 14px 0 0 0; font-size: 12px; color: #6B7280; font-weight: 500;">
          🔒 Lien sécurisé valable 72 heures
        </p>
      </div>

      <!-- Info Box -->
      <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border: 2px solid #FCD34D; border-radius: 12px; padding: 20px 24px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #78350F;">
          📋 Préparez ces informations :
        </p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 4px 0;">
              <span style="font-size: 13px; color: #92400E; line-height: 1.7;">✓ Nom de votre entreprise</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">
              <span style="font-size: 13px; color: #92400E; line-height: 1.7;">✓ Matricule fiscal (si disponible)</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">
              <span style="font-size: 13px; color: #92400E; line-height: 1.7;">✓ Numéro RIB et nom de votre banque</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">
              <span style="font-size: 13px; color: #92400E; line-height: 1.7;">✓ Numéro de téléphone</span>
            </td>
          </tr>
        </table>
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

    try {
      await this.transporter.sendMail({
        from:    `"${businessName}" <${businessEmail}>`,
        to:      email,
        replyTo: businessEmail,
        subject: `Invitation fournisseur — ${businessName} vous invite`,
        html,
        attachments: [
          {
            filename: 'logo.png',
            path: './public/logo.png',
            cid: 'logo@novaentra',
          },
        ],
      });
      this.logger.log(`Invitation fournisseur envoyée à ${email} pour business ${businessId} (from: ${businessEmail})`);
    } catch (err: any) {
      this.logger.error(`Échec envoi invitation : ${err.message}`);
      throw new BadRequestException('Impossible d\'envoyer l\'email. Vérifiez la configuration SMTP.');
    }

    return { message: `Invitation envoyée à ${email}`, token };
  }

  // ─── Récupérer les données d'invitation ────────────────────────────────────
  async getInvitationData(token: string): Promise<{
    email:         string;
    name:          string | null;
    business_name: string;
  }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_PORTAL_SECRET', 'portal_secret'),
      });
    } catch {
      throw new BadRequestException('Lien invalide ou expiré. Demandez une nouvelle invitation.');
    }

    if (payload.type !== 'supplier_invite') {
      throw new BadRequestException('Type de token invalide.');
    }

    const business = await this.businessRepo.findOne({
      where: { id: payload.business_id },
    });

    return {
      email:         payload.email,
      name:          payload.name ?? null,
      business_name: (business as any)?.name ?? 'Votre client',
    };
  }

  // ─── Fournisseur complète sa fiche ─────────────────────────────────────────
  async completeInvitation(token: string, dto: {
    name:             string;
    phone?:           string;
    matricule_fiscal?: string;
    rib?:             string;
    bank_name?:       string;
    category?:        string;
    payment_terms?:   number;
    notes?:           string;
    address?:         { street?: string; city?: string; postal_code?: string; country?: string };
  }): Promise<Supplier> {

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_PORTAL_SECRET', 'portal_secret'),
      });
    } catch {
      throw new BadRequestException('Lien expiré. Demandez une nouvelle invitation.');
    }

    if (payload.type !== 'supplier_invite') {
      throw new BadRequestException('Token invalide.');
    }

    if (!dto.name?.trim()) {
      throw new BadRequestException('Le nom est obligatoire.');
    }

    // Vérifier si déjà créé (idempotence)
    const existing = await this.supplierRepo.findOne({
      where: { business_id: payload.business_id, email: payload.email },
    });
    if (existing) {
      throw new BadRequestException(
        'Votre fiche fournisseur a déjà été créée avec cet email.',
      );
    }

    const supplier = this.supplierRepo.create({
      business_id:      payload.business_id,
      name:             dto.name.trim(),
      email:            payload.email,
      phone:            dto.phone?.trim() || undefined,
      matricule_fiscal: dto.matricule_fiscal?.trim() || undefined,
      rib:              dto.rib?.trim() || undefined,
      bank_name:        dto.bank_name?.trim() || undefined,
      category:         dto.category?.trim() || undefined,
      payment_terms:    dto.payment_terms ?? 30,
      notes:            dto.notes?.trim() || undefined,
      address:          dto.address && Object.values(dto.address).some(v => v)
                          ? dto.address : undefined,
      is_active:        true,
    });

    const saved = await this.supplierRepo.save(supplier);

    // Notifier le business owner
    await this.notifyBusinessOwner(payload.business_id, saved);

    this.logger.log(`Fournisseur ${saved.name} (${saved.email}) créé via invitation pour business ${payload.business_id}`);
    return saved;
  }

  // ─── Notifier le business owner qu'un fournisseur a complété sa fiche ─────
  private async notifyBusinessOwner(businessId: string, supplier: Supplier): Promise<void> {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    const ownerEmail = (business as any)?.email;
    if (!ownerEmail) return;

    const businessName = (business as any)?.name ?? 'Votre société';

    try {
      await this.transporter.sendMail({
        from:    `"${supplier.name}" <${ownerEmail}>`,
        to:      ownerEmail,
        subject: `✅ Nouveau fournisseur — ${supplier.name} a complété sa fiche`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f5f5f5;padding:20px;">
  <div style="background:#16A34A;padding:18px 24px;border-radius:10px 10px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:17px;">✅ Nouveau fournisseur enregistré</h2>
    <p style="color:#BBF7D0;margin:3px 0 0;font-size:12px;">${supplier.name} a complété sa fiche fournisseur</p>
  </div>
  <div style="background:#fff;padding:20px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px;">
      Bonjour,<br><br>
      <strong>${supplier.name}</strong> a complété sa fiche fournisseur suite à votre invitation.
      Vous pouvez maintenant lui envoyer des bons de commande.
    </p>
    <div style="background:#F9FAFB;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <table style="width:100%;font-size:13px;">
        <tr><td style="color:#6B7280;padding:3px 0;">Nom</td><td style="font-weight:600;text-align:right;">${supplier.name}</td></tr>
        <tr><td style="color:#6B7280;padding:3px 0;">Email</td><td style="text-align:right;">${supplier.email}</td></tr>
        ${supplier.phone ? `<tr><td style="color:#6B7280;padding:3px 0;">Téléphone</td><td style="text-align:right;">${supplier.phone}</td></tr>` : ''}
        ${supplier.matricule_fiscal ? `<tr><td style="color:#6B7280;padding:3px 0;">Matricule fiscal</td><td style="text-align:right;">${supplier.matricule_fiscal}</td></tr>` : ''}
        ${supplier.rib ? `<tr><td style="color:#6B7280;padding:3px 0;">RIB</td><td style="text-align:right;">${supplier.rib}</td></tr>` : ''}
        ${supplier.bank_name ? `<tr><td style="color:#6B7280;padding:3px 0;">Banque</td><td style="text-align:right;">${supplier.bank_name}</td></tr>` : ''}
      </table>
    </div>
    <div style="text-align:center;">
      <a href="${this.frontendUrl}/app/purchases/suppliers"
        style="display:inline-block;padding:10px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
        Voir le fournisseur →
      </a>
    </div>
  </div>
  <div style="padding:12px;text-align:center;font-size:11px;color:#9CA3AF;">
    Notification automatique — ${businessName}
  </div>
</body></html>`,
      });
    } catch (err: any) {
      this.logger.error(`Échec notification business owner : ${err.message}`);
    }
  }
}