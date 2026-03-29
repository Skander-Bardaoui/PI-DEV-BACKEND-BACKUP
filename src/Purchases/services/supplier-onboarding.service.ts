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
<html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;}
  .btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;}
</style>
</head>
<body>

  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Invitation fournisseur</h1>
    <p style="color:#C7D2FE;margin:4px 0 0;font-size:13px;">${businessName} vous invite à rejoindre sa plateforme</p>
  </div>

  <div style="background:#fff;padding:28px 32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;">

    <p style="font-size:15px;color:#374151;line-height:1.8;margin-bottom:20px;">
      Bonjour${name ? ` <strong>${name}</strong>` : ''},<br><br>
      <strong>${businessName}</strong> vous invite à créer votre fiche fournisseur
      sur leur plateforme de gestion des achats.<br><br>
      Il vous suffit de <strong>cliquer sur le bouton ci-dessous</strong> et de remplir
      votre fiche en quelques minutes. Vous n'avez pas besoin de créer un compte.
    </p>

    <!-- Étapes -->
    <div style="background:#F8F9FF;border:1px solid #E0E7FF;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#3730A3;">Comment ça marche :</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:26px;height:26px;border-radius:50%;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</div>
          <span style="font-size:13px;color:#374151;">Cliquez sur le bouton et remplissez votre fiche (5 min)</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:26px;height:26px;border-radius:50%;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</div>
          <span style="font-size:13px;color:#374151;">Votre fiche est validée automatiquement</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:26px;height:26px;border-radius:50%;background:#16A34A;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</div>
          <span style="font-size:13px;color:#374151;">${businessName} peut maintenant vous envoyer des bons de commande</span>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${inviteUrl}" class="btn">Créer ma fiche fournisseur →</a>
      <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">
        Ce lien est valable 72 heures — usage unique
      </p>
    </div>

    <!-- Infos à avoir -->
    <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:14px 18px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400E;">📋 Préparez ces informations :</p>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350F;line-height:1.8;">
        <li>Nom de votre entreprise</li>
        <li>Matricule fiscal (si disponible)</li>
        <li>Numéro RIB et nom de votre banque</li>
        <li>Numéro de téléphone</li>
      </ul>
    </div>
  </div>

  <div style="padding:14px;text-align:center;font-size:11px;color:#9CA3AF;">
    Si vous n'êtes pas concerné par cette invitation, ignorez cet email.
    Invitation envoyée par ${businessName} via NovaEntra.
  </div>

</body></html>`;

    try {
      await this.transporter.sendMail({
        from:    `"${businessName}" <${businessEmail}>`,
        to:      email,
        replyTo: businessEmail,
        subject: `Invitation fournisseur — ${businessName} vous invite`,
        html,
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