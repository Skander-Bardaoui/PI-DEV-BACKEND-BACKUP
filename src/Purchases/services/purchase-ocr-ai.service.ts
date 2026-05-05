// src/Purchases/services/purchase-ocr-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseGeminiJson } from '../utils/json-parser.util';

export interface OcrAiResult {
  documentType: 'PURCHASE_INVOICE' | 'PURCHASE_ORDER' | 'DELIVERY_NOTE' | 'UNKNOWN';
  confidence: number;
  mappedFields: {
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    supplierName?: string;
    supplierAddress?: string;
    supplierTaxId?: string;
    items?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      total?: number;
    }>;
    subtotalHt?: number;
    taxAmount?: number;
    timbreFiscal?: number;
    totalTtc?: number;
    notes?: string;
  };
  rawAiResponse: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Injectable()
export class PurchaseOcrAiService {
  private readonly logger = new Logger(PurchaseOcrAiService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — fonctionnalités AI désactivées');
    }
  }

  async enrichOcrText(rawText: string): Promise<OcrAiResult> {
    if (!this.apiKey) return this.getFallbackResult(rawText);

    const prompt = `Tu es un expert comptable tunisien spécialisé en extraction de données de factures.

TEXTE OCR BRUT:
${rawText}

Analyse ce texte et extrais les informations de la facture d'achat.

INSTRUCTIONS:
1. Identifie le type de document (FACTURE, BON DE COMMANDE, BON DE LIVRAISON)
2. Extrais TOUTES les données visibles
3. Calcule un score de confiance (0-100) basé sur la qualité et complétude des données
4. Pour les montants: convertis les virgules en points décimaux
5. Pour les dates: format YYYY-MM-DD
6. Timbre fiscal par défaut: 1.000 TND (Tunisie)

RÉPONDS EN JSON STRICT:
{
  "documentType": "PURCHASE_INVOICE",
  "confidence": 85,
  "mappedFields": {
    "invoiceNumber": "FAC-2024-001",
    "invoiceDate": "2024-01-15",
    "dueDate": "2024-02-15",
    "supplierName": "Nom du fournisseur",
    "supplierAddress": "Adresse complète",
    "supplierTaxId": "1234567X",
    "items": [
      {
        "description": "Article 1",
        "quantity": 10,
        "unitPrice": 50.5,
        "taxRate": 19,
        "total": 505.0
      }
    ],
    "subtotalHt": 505.0,
    "taxAmount": 95.95,
    "timbreFiscal": 1.0,
    "totalTtc": 601.95,
    "notes": "Notes éventuelles"
  }
}`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
          },
        }),
      });

      if (!response.ok) {
        this.logger.error(`Gemini API error: ${response.status}`);
        return this.getFallbackResult(rawText);
      }

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.debug(`Gemini enrichOcrText réponse: ${text.substring(0, 200)}...`);

      // Nettoyage et extraction du JSON
      let cleanedText = text
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedText);
      
      // Validation et valeurs par défaut
      const confidence = typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50;
      const documentType = ['PURCHASE_INVOICE', 'PURCHASE_ORDER', 'DELIVERY_NOTE', 'UNKNOWN'].includes(parsed.documentType) 
        ? parsed.documentType 
        : 'UNKNOWN';

      this.logger.log(`AI enrichissement — Type: ${documentType}, Confiance: ${confidence}%`);

      return {
        documentType,
        confidence,
        mappedFields: parsed.mappedFields ?? {},
        rawAiResponse: text,
      };
    } catch (error: any) {
      this.logger.error(`Erreur enrichissement AI: ${error.message}`);
      return this.getFallbackResult(rawText);
    }
  }

  async analyzeImageBuffer(buffer: Buffer, mimeType: string): Promise<OcrAiResult> {
    if (!this.apiKey) return this.getFallbackResult('');

    const prompt = `Tu es un expert comptable tunisien. Analyse cette image de facture d'achat.

INSTRUCTIONS:
1. Lis TOUTES les informations visibles sur le document
2. Identifie le type: FACTURE (PURCHASE_INVOICE), BON DE COMMANDE (PURCHASE_ORDER), ou BON DE LIVRAISON (DELIVERY_NOTE)
3. Extrais: numéro, dates, fournisseur, articles, montants
4. Calcule un score de confiance (0-100) selon la qualité de lecture
5. Dates au format YYYY-MM-DD
6. Montants en décimaux (virgule → point)
7. Timbre fiscal: 1.000 TND par défaut

RÉPONDS EN JSON:
{
  "documentType": "PURCHASE_INVOICE",
  "confidence": 90,
  "mappedFields": {
    "invoiceNumber": "FAC-001",
    "invoiceDate": "2024-01-15",
    "supplierName": "Nom fournisseur",
    "items": [{"description": "Article", "quantity": 1, "unitPrice": 100, "total": 100}],
    "subtotalHt": 100,
    "taxAmount": 19,
    "timbreFiscal": 1.0,
    "totalTtc": 120
  }
}`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
            ],
          }],
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
          },
        }),
      });

      if (!response.ok) {
        this.logger.error(`Gemini Vision API error: ${response.status}`);
        return this.getFallbackResult('');
      }

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.debug(`Gemini Vision réponse: ${text.substring(0, 200)}...`);

      // Nettoyage et extraction du JSON
      let cleanedText = text
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedText);
      
      // Validation et valeurs par défaut
      const confidence = typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50;
      const documentType = ['PURCHASE_INVOICE', 'PURCHASE_ORDER', 'DELIVERY_NOTE', 'UNKNOWN'].includes(parsed.documentType) 
        ? parsed.documentType 
        : 'UNKNOWN';

      this.logger.log(`Vision AI — Type: ${documentType}, Confiance: ${confidence}%`);

      return {
        documentType,
        confidence,
        mappedFields: parsed.mappedFields ?? {},
        rawAiResponse: text,
      };
    } catch (error: any) {
      this.logger.error(`Erreur Vision AI: ${error.message}`);
      return this.getFallbackResult('');
    }
  }

  private getFallbackResult(rawText: string): OcrAiResult {
    this.logger.log('Utilisation du fallback regex pour extraction OCR');
    const mappedFields: OcrAiResult['mappedFields'] = {};

    // Numéro de facture
    for (const p of [/(?:facture|invoice|n°|no)\s*:?\s*([A-Z0-9\-\/]+)/i, /([A-Z]{2,4}[-\/]\d{4}[-\/]\d+)/i]) {
      const m = rawText.match(p);
      if (m) { mappedFields.invoiceNumber = m[1].trim(); break; }
    }

    // Date
    for (const p of [/(?:date|du)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/]) {
      const m = rawText.match(p);
      if (m) { mappedFields.invoiceDate = this.parseDate(m[1]); break; }
    }

    // Fournisseur
    for (const p of [/(?:fournisseur|vendeur|supplier)\s*:?\s*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i]) {
      const m = rawText.match(p);
      if (m) { mappedFields.supplierName = m[1].trim(); break; }
    }

    // Montants
    const amounts: Record<string, RegExp[]> = {
      totalTtc: [/(?:net\s*à\s*payer|total\s*ttc)\s*:?\s*([\d\s]+[,\.]\d{1,3})/i],
      subtotalHt: [/(?:sous-?total|total)\s*ht\s*:?\s*([\d\s]+[,\.]\d{1,3})/i],
      taxAmount: [/tva\s*(?:\d+%)?\s*:?\s*([\d\s]+[,\.]\d{1,3})/i],
      timbreFiscal: [/timbre\s*fiscal\s*:?\s*([\d\s]+[,\.]\d{1,3})/i],
    };
    for (const [key, patterns] of Object.entries(amounts)) {
      for (const p of patterns) {
        const m = rawText.match(p);
        if (m) { (mappedFields as any)[key] = this.parseAmount(m[1]); break; }
      }
    }
    mappedFields.timbreFiscal ??= 1.000;

    let documentType: OcrAiResult['documentType'] = 'UNKNOWN';
    if (/facture|invoice/i.test(rawText)) documentType = 'PURCHASE_INVOICE';
    else if (/bon\s+de\s+commande/i.test(rawText)) documentType = 'PURCHASE_ORDER';
    else if (/bon\s+de\s+livraison/i.test(rawText)) documentType = 'DELIVERY_NOTE';

    return {
      documentType,
      confidence: Math.min(100, Object.keys(mappedFields).length * 15),
      mappedFields,
      rawAiResponse: 'Fallback regex',
    };
  }

  private parseDate(s: string): string {
    const parts = s.split(/[\/\-\.]/);
    if (parts.length !== 3) return s;
    let [d, m, y] = parts;
    if (y.length === 2) y = String(Math.floor(new Date().getFullYear() / 100) * 100 + parseInt(y));
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  private parseAmount(s: string): number {
    return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0;
  }
}