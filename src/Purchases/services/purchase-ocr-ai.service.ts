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

Extrais les données et retourne UNIQUEMENT ce JSON compact:
{"documentType":"PURCHASE_INVOICE|PURCHASE_ORDER|DELIVERY_NOTE|UNKNOWN","confidence":0,"mappedFields":{"invoiceNumber":null,"invoiceDate":null,"dueDate":null,"supplierName":null,"supplierAddress":null,"supplierTaxId":null,"items":[{"description":"","quantity":0,"unitPrice":0,"total":0}],"subtotalHt":null,"taxAmount":null,"timbreFiscal":1.000,"totalTtc":null,"notes":null}}

RÈGLES:
- Dates au format YYYY-MM-DD
- Montants en nombres décimaux (virgule → point)
- timbreFiscal = 1.000 TND par défaut en Tunisie
- confidence = 0-100 selon qualité des données extraites`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });

      if (!response.ok) throw new Error(`Gemini API: ${response.status}`);

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.debug(`Gemini enrichOcrText réponse: ${text.length} chars`);

      const parsed = parseGeminiJson(text);
      this.logger.log(`AI enrichissement — Type: ${parsed.documentType}, Confiance: ${parsed.confidence}%`);

      return {
        documentType: parsed.documentType ?? 'UNKNOWN',
        confidence: parsed.confidence ?? 0,
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

    const prompt = `Tu es un expert comptable tunisien. Analyse cette image de document fournisseur.

Retourne UNIQUEMENT ce JSON compact:
{"documentType":"PURCHASE_INVOICE|PURCHASE_ORDER|DELIVERY_NOTE|UNKNOWN","confidence":0,"mappedFields":{"invoiceNumber":null,"invoiceDate":null,"dueDate":null,"supplierName":null,"supplierAddress":null,"supplierTaxId":null,"items":[{"description":"","quantity":0,"unitPrice":0,"total":0}],"subtotalHt":null,"taxAmount":null,"timbreFiscal":1.000,"totalTtc":null,"notes":null}}

RÈGLES: dates YYYY-MM-DD, montants décimaux, timbreFiscal=1.000 par défaut`;

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });

      if (!response.ok) throw new Error(`Gemini Vision API: ${response.status}`);

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.debug(`Gemini Vision réponse: ${text.length} chars`);

      const parsed = parseGeminiJson(text);
      this.logger.log(`Vision AI — Type: ${parsed.documentType}, Confiance: ${parsed.confidence}%`);

      return {
        documentType: parsed.documentType ?? 'UNKNOWN',
        confidence: parsed.confidence ?? 0,
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