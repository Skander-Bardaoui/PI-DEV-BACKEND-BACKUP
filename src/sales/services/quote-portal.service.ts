// src/sales/services/quote-portal.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { QuotePortalToken } from '../entities/quote-portal-token.entity';
import { Quote, QuoteStatus } from '../entities/quote.entity';
import { Client } from '../entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';
import { QuotesService } from './quotes.service';

@Injectable()
export class QuotePortalService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(QuotePortalToken)
    private readonly tokenRepo: Repository<QuotePortalToken>,

    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    private readonly quotesService: QuotesService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
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

  async generatePortalToken(
    businessId: string,
    clientId: string,
    quoteId: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    const portalToken = this.tokenRepo.create({
      token,
      business_id: businessId,
      client_id: clientId,
      quote_id: quoteId,
      expires_at: expiresAt,
      used: false,
    });

    await this.tokenRepo.save(portalToken);
    return token;
  }

  async getPortalData(token: string) {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: [
        'business',
        'client',
        'quote',
        'quote.items',
      ],
    });

    if (!portalToken) {
      throw new NotFoundException('Token invalide ou expiré');
    }

    if (new Date() > portalToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    if (portalToken.quote.status === QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Ce devis a déjà été accepté');
    }

    if (portalToken.quote.status === QuoteStatus.REJECTED) {
      throw new BadRequestException('Ce devis a déjà été refusé');
    }

    return {
      business: portalToken.business,
      client: portalToken.client,
      quote: portalToken.quote,
      token: portalToken.token,
    };
  }

  async acceptQuote(token: string): Promise<{ quote: Quote; order: any }> {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: ['quote', 'business'],
    });

    if (!portalToken) throw new NotFoundException('Token invalide');
    if (new Date() > portalToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    const quote = portalToken.quote;

    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException(
        `Ce devis ne peut pas être accepté. Statut actuel: ${quote.status}`,
      );
    }

    // Accept the quote
    quote.status = QuoteStatus.ACCEPTED;
    quote.acceptedAt = new Date();
    await this.quoteRepo.save(quote);

    // Mark token as used
    portalToken.used = true;
    await this.tokenRepo.save(portalToken);

    // Auto-convert to sales order
    const order = await this.quotesService.convertToOrder(
      quote.businessId,
      quote.id,
    );

    // Reload quote to get updated data with business relation
    const updatedQuote = await this.quoteRepo.findOne({
      where: { id: quote.id },
      relations: ['business', 'client'],
    });

    return { quote: updatedQuote || quote, order };
  }

  async rejectQuote(token: string, reason?: string): Promise<Quote> {
    const portalToken = await this.tokenRepo.findOne({
      where: { token },
      relations: ['quote'],
    });

    if (!portalToken) throw new NotFoundException('Token invalide');
    if (new Date() > portalToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    const quote = portalToken.quote;

    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException(
        `Ce devis ne peut pas être refusé. Statut actuel: ${quote.status}`,
      );
    }

    quote.status = QuoteStatus.REJECTED;
    quote.rejectedAt = new Date();
    quote.rejectionReason = reason || null;
    await this.quoteRepo.save(quote);

    // Mark token as used
    portalToken.used = true;
    await this.tokenRepo.save(portalToken);

    return quote;
  }

  async sendQuoteEmail(businessId: string, quoteId: string): Promise<void> {
    const quote = await this.quoteRepo.findOne({
      where: { id: quoteId, businessId },
      relations: ['client', 'business', 'items'],
    });

    if (!quote) {
      throw new NotFoundException('Devis introuvable');
    }

    if (!quote.client.email) {
      throw new BadRequestException('Le client n\'a pas d\'email');
    }

    // Generate portal token
    const token = await this.generatePortalToken(
      businessId,
      quote.clientId,
      quoteId,
    );

    const portalUrl = `${this.frontendUrl}/quote-portal?token=${token}`;
    const businessName = quote.business.name || 'Votre Entreprise';
    const businessEmail = (quote.business as any).email || this.from;

    // Build email HTML
    const html = this.buildQuoteEmail(quote, businessName, portalUrl);

    try {
      await this.transporter.sendMail({
        from: `"${businessName}" <${this.from}>`,
        to: quote.client.email,
        replyTo: businessEmail,
        subject: `Nouveau devis ${quote.quoteNumber} - ${businessName}`,
        html,
        attachments: [
          {
            filename: 'logo.png',
            path: './public/logo.png',
            cid: 'logo@novaentra',
          },
        ],
      });

      // Update quote status to SENT
      quote.status = QuoteStatus.SENT;
      quote.sentAt = new Date();
      await this.quoteRepo.save(quote);
    } catch (err: any) {
      throw new BadRequestException(
        `Impossible d'envoyer l'email: ${err.message}`,
      );
    }
  }

  private buildQuoteEmail(quote: Quote, businessName: string, portalUrl: string): string {
    const itemsHtml = quote.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${Number(item.unitPrice).toFixed(3)} DT</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">${(Number(item.quantity) * Number(item.unitPrice)).toFixed(3)} DT</td>
        </tr>
      `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 32px; border-radius: 16px 16px 0 0; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);">
      <div style="text-align: center;">
        <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.95); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; padding: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
          <img src="cid:logo@novaentra" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Nouveau Devis</h1>
        <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">${businessName}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background: #ffffff; padding: 36px 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      
      <p style="font-size: 16px; color: #1F2937; line-height: 1.7; margin: 0 0 24px 0;">
        Bonjour <strong style="color: #4F46E5;">${quote.client.name}</strong>,
      </p>

      <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">
        Nous avons le plaisir de vous transmettre notre devis <strong>${quote.quoteNumber}</strong>.
      </p>

      <!-- Quote Details -->
      <div style="background: #F9FAFB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="color: #6B7280; padding: 6px 0;">Numéro de devis</td>
            <td style="font-weight: 600; text-align: right;">${quote.quoteNumber}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; padding: 6px 0;">Date</td>
            <td style="text-align: right;">${new Date(quote.quoteDate).toLocaleDateString('fr-FR')}</td>
          </tr>
          ${quote.validUntil ? `
          <tr>
            <td style="color: #6B7280; padding: 6px 0;">Valable jusqu'au</td>
            <td style="text-align: right;">${new Date(quote.validUntil).toLocaleDateString('fr-FR')}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="color: #6B7280; padding: 6px 0; padding-top: 12px; border-top: 1px solid #E5E7EB;">Montant total</td>
            <td style="text-align: right; font-weight: 700; font-size: 18px; color: #4F46E5; padding-top: 12px; border-top: 1px solid #E5E7EB;">${Number(quote.netAmount).toFixed(3)} DT</td>
          </tr>
        </table>
      </div>

      <!-- Items Table -->
      <div style="margin-bottom: 32px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #F3F4F6;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Description</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Qté</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Prix Unit.</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <!-- Action Buttons -->
      <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border: 2px solid #C7D2FE; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 20px 0; font-size: 15px; font-weight: 600; color: #1E1B4B;">
          Votre réponse est attendue
        </p>
        
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #4B5563;">
          Confirmez ou refusez ce devis directement depuis votre portail client sécurisé.
        </p>
        
        <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
          Accéder à mon portail client →
        </a>

        <p style="margin: 16px 0 0 0; font-size: 12px; color: #6B7280; font-weight: 500;">
          🔒 Lien sécurisé — valable 30 jours
        </p>
      </div>

      ${quote.notes ? `
      <div style="background: #FEF3C7; border: 2px solid #FCD34D; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #92400E;">
          <strong>Note:</strong> ${quote.notes}
        </p>
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #6B7280; line-height: 1.6; margin: 0;">
        Pour toute question, n'hésitez pas à nous contacter.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 16px;">
      <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
        Email envoyé par <strong>${businessName}</strong> via NovaEntra
      </p>
    </div>

  </div>
</body>
</html>`;
  }
}
