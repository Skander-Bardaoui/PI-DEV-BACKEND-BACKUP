// src/sales/services/sales-email-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface EmailDraftParams {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  isReminder: boolean;
  language?: 'fr' | 'ar';
  businessName?: string;
}

export interface EmailDraftResult {
  subject: string;
  body: string;
}

@Injectable()
export class SalesEmailAiService {
  private readonly logger = new Logger(SalesEmailAiService.name);
  private readonly model: GenerativeModel | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — génération email AI désactivée');
      this.model = null;
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser gemini-2.5-flash (version stable et largement disponible)
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.logger.log('Service email AI initialisé avec succès (gemini-2.5-flash)');
      } catch (error: any) {
        this.logger.error(`Erreur initialisation Gemini: ${error.message}`);
        this.model = null;
      }
    }
  }

  async generateEmailDraft(params: EmailDraftParams): Promise<EmailDraftResult> {
    if (!this.model) {
      // Return a simple template if AI is not available
      return this.getFallbackEmailDraft(params);
    }

    try {
      const lang = params.language === 'ar' ? 'arabe' : 'français';
      const type = params.isReminder 
        ? 'rappel de paiement (facture en retard)' 
        : 'envoi initial de facture';

      const prompt = `
Rédige un email professionnel en ${lang} pour un ${type}.
Ton: professionnel mais chaleureux. Longueur: 3-4 phrases max.

Informations:
- Entreprise: ${params.businessName || 'Votre Entreprise'}
- Client: ${params.clientName}
- Facture n°: ${params.invoiceNumber}
- Montant: ${params.amount.toFixed(3)} TND
- Échéance: ${params.dueDate}
- Type: ${params.isReminder ? 'RAPPEL — facture en retard' : 'PREMIER ENVOI'}

IMPORTANT: Signe l'email avec le nom de l'entreprise "${params.businessName || 'Votre Entreprise'}" à la fin.

Retourne UNIQUEMENT ce JSON (sans backticks):
{
  "subject": "Objet de l'email",
  "body": "Corps complet de l'email avec salutation et signature."
}
      `;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      this.logger.log(`Email draft généré pour facture ${params.invoiceNumber} en ${lang}`);

      return {
        subject: parsed.subject || 'Facture',
        body: parsed.body || '',
      };
    } catch (error: any) {
      this.logger.error(`Erreur génération email draft: ${error.message}`);
      // Return fallback template on error
      return this.getFallbackEmailDraft(params);
    }
  }

  private getFallbackEmailDraft(params: EmailDraftParams): EmailDraftResult {
    const lang = params.language === 'ar' ? 'ar' : 'fr';
    const businessName = params.businessName || 'Votre Entreprise';
    
    if (params.isReminder) {
      // Reminder email
      if (lang === 'ar') {
        return {
          subject: `تذكير بالدفع - فاتورة ${params.invoiceNumber}`,
          body: `السيد/السيدة ${params.clientName}،\n\nنود تذكيركم بأن الفاتورة رقم ${params.invoiceNumber} بمبلغ ${params.amount.toFixed(3)} دينار تونسي لم يتم دفعها بعد. تاريخ الاستحقاق كان ${params.dueDate}.\n\nنرجو منكم تسوية هذا المبلغ في أقرب وقت ممكن.\n\nمع خالص الشكر والتقدير،\n${businessName}`,
        };
      } else {
        return {
          subject: `Rappel de paiement - Facture ${params.invoiceNumber}`,
          body: `Bonjour ${params.clientName},\n\nNous vous rappelons que la facture n° ${params.invoiceNumber} d'un montant de ${params.amount.toFixed(3)} TND n'a pas encore été réglée. La date d'échéance était le ${params.dueDate}.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.\n\nCordialement,\n${businessName}`,
        };
      }
    } else {
      // Initial invoice email
      if (lang === 'ar') {
        return {
          subject: `فاتورة ${params.invoiceNumber} - ${params.clientName}`,
          body: `السيد/السيدة ${params.clientName}،\n\nيسرنا أن نرسل لكم الفاتورة رقم ${params.invoiceNumber} بمبلغ ${params.amount.toFixed(3)} دينار تونسي. تاريخ الاستحقاق هو ${params.dueDate}.\n\nستجدون الفاتورة مرفقة بهذا البريد الإلكتروني.\n\nمع خالص الشكر والتقدير،\n${businessName}`,
        };
      } else {
        return {
          subject: `Facture ${params.invoiceNumber} - ${params.clientName}`,
          body: `Bonjour ${params.clientName},\n\nVeuillez trouver ci-joint la facture n° ${params.invoiceNumber} d'un montant de ${params.amount.toFixed(3)} TND. La date d'échéance est fixée au ${params.dueDate}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${businessName}`,
        };
      }
    }
  }
}
