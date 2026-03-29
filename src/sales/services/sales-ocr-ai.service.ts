// src/sales/services/sales-ocr-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface OcrAiResult {
  documentType: 'INVOICE' | 'QUOTE' | 'DELIVERY_NOTE' | 'ORDER' | 'UNKNOWN';
  confidence: number;
  mappedFields: {
    documentNumber?: string;
    date?: string;
    dueDate?: string;
    clientName?: string;
    clientAddress?: string;
    clientTaxId?: string;
    items?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      total?: number;
    }>;
    subtotalHt?: number;
    taxAmount?: number;
    totalTtc?: number;
    notes?: string;
  };
  rawAiResponse: string;
}

@Injectable()
export class SalesOcrAiService {
  private readonly logger = new Logger(SalesOcrAiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — fonctionnalités AI désactivées');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Enrichit le texte OCR brut avec l'IA Gemini
   */
  async enrichOcrText(rawText: string): Promise<OcrAiResult> {
    if (!this.genAI) {
      return this.getFallbackResult(rawText);
    }

    try {
      // Utiliser gemini-2.5-flash (version stable et largement disponible)
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
Tu es un expert en extraction de données de documents commerciaux (factures, devis, bons de livraison, commandes).

Analyse le texte OCR suivant et extrais les informations structurées au format JSON.

TEXTE OCR:
${rawText}

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte:
{
  "documentType": "INVOICE" | "QUOTE" | "DELIVERY_NOTE" | "ORDER" | "UNKNOWN",
  "confidence": 0-100,
  "mappedFields": {
    "documentNumber": "string ou null",
    "date": "YYYY-MM-DD ou null",
    "dueDate": "YYYY-MM-DD ou null",
    "clientName": "string ou null",
    "clientAddress": "string ou null",
    "clientTaxId": "string ou null",
    "items": [
      {
        "description": "string",
        "quantity": number,
        "unitPrice": number,
        "taxRate": number (optionnel),
        "total": number (optionnel)
      }
    ],
    "subtotalHt": number ou null,
    "taxAmount": number ou null,
    "totalTtc": number ou null,
    "notes": "string ou null"
  }
}

RÈGLES:
- Identifie le type de document (facture, devis, etc.)
- Extrais TOUS les articles/lignes du document
- Convertis les dates au format ISO (YYYY-MM-DD)
- Convertis les montants en nombres décimaux
- Si une information n'est pas trouvée, mets null
- Calcule un score de confiance basé sur la qualité des données extraites
- Ne retourne QUE le JSON, sans texte avant ou après
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Nettoyer la réponse (enlever les backticks markdown si présents)
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedText);

      this.logger.log(`AI enrichissement réussi — Type: ${parsed.documentType}, Confiance: ${parsed.confidence}%`);

      return {
        documentType: parsed.documentType || 'UNKNOWN',
        confidence: parsed.confidence || 0,
        mappedFields: parsed.mappedFields || {},
        rawAiResponse: text,
      };

    } catch (error: any) {
      this.logger.error(`Erreur lors de l'enrichissement AI: ${error.message}`);
      return this.getFallbackResult(rawText);
    }
  }

  /**
   * Analyse une image directement avec Gemini Vision
   */
  async analyzeImageBuffer(
    buffer: Buffer,
    mimeType: string,
  ): Promise<OcrAiResult> {
    if (!this.genAI) {
      return this.getFallbackResult('');
    }

    try {
      // Utiliser gemini-2.5-flash (version stable pour analyse d'images)
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const imagePart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      };

      const prompt = `
Analyse cette image de document commercial (facture, devis, bon de livraison, ou commande).

Extrais toutes les informations et retourne UNIQUEMENT un objet JSON valide avec cette structure:
{
  "documentType": "INVOICE" | "QUOTE" | "DELIVERY_NOTE" | "ORDER" | "UNKNOWN",
  "confidence": 0-100,
  "mappedFields": {
    "documentNumber": "string ou null",
    "date": "YYYY-MM-DD ou null",
    "dueDate": "YYYY-MM-DD ou null",
    "clientName": "string ou null",
    "clientAddress": "string ou null",
    "clientTaxId": "string ou null",
    "items": [
      {
        "description": "string",
        "quantity": number,
        "unitPrice": number,
        "taxRate": number (optionnel),
        "total": number (optionnel)
      }
    ],
    "subtotalHt": number ou null,
    "taxAmount": number ou null,
    "totalTtc": number ou null,
    "notes": "string ou null"
  }
}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans texte explicatif.
`;

      const result = await model.generateContent([prompt, imagePart]);
      const response = result.response;
      const text = response.text();

      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedText);

      this.logger.log(`Vision AI analyse réussie — Type: ${parsed.documentType}`);

      return {
        documentType: parsed.documentType || 'UNKNOWN',
        confidence: parsed.confidence || 0,
        mappedFields: parsed.mappedFields || {},
        rawAiResponse: text,
      };

    } catch (error: any) {
      this.logger.error(`Erreur lors de l'analyse Vision: ${error.message}`);
      return this.getFallbackResult('');
    }
  }

  /**
   * Résultat de secours si l'API AI n'est pas disponible
   * Utilise des regex avancées pour extraire les données
   */
  private getFallbackResult(rawText: string): OcrAiResult {
    this.logger.log('Utilisation du fallback intelligent pour extraction OCR');
    this.logger.log(`Texte OCR (premiers 500 chars): ${rawText.substring(0, 500)}`);
    
    const mappedFields: any = {};
    
    // Extraction du numéro de document
    const docNumberPatterns = [
      /(?:facture|invoice|n°|no|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
      /([A-Z]{2,4}[-\/]\d{4}[-\/]\d+)/i,
    ];
    for (const pattern of docNumberPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        mappedFields.documentNumber = match[1].trim();
        this.logger.log(`✓ Numéro document trouvé: ${mappedFields.documentNumber}`);
        break;
      }
    }

    // Extraction des dates
    const datePatterns = [
      /(?:date|du)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    ];
    for (const pattern of datePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        mappedFields.date = this.parseDate(match[1]);
        this.logger.log(`✓ Date trouvée: ${mappedFields.date}`);
        break;
      }
    }

    // Extraction date d'échéance
    const dueDatePatterns = [
      /(?:échéance|due date)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];
    for (const pattern of dueDatePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        mappedFields.dueDate = this.parseDate(match[1]);
        this.logger.log(`✓ Date échéance trouvée: ${mappedFields.dueDate}`);
        break;
      }
    }

    // Extraction du nom du client
    const clientPatterns = [
      /(?:client|customer)\s*:?\s*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i,
      /(?:à|to)\s*:?\s*([A-Za-zÀ-ÿ\s]+?)(?:\n|$)/i,
    ];
    for (const pattern of clientPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        mappedFields.clientName = match[1].trim();
        this.logger.log(`✓ Client trouvé: ${mappedFields.clientName}`);
        break;
      }
    }

    // Extraction des montants - patterns plus robustes
    const amountPatterns = {
      totalTtc: [
        /(?:total|net|montant)\s*(?:ttc|total)?\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
        /(?:total|net)\s*:?\s*([\d\s]+[,\.]\d{1,3})\s*(?:dt|tnd|€|eur|dinars?)/i,
        /(?:à\s*payer|montant\s*dû)\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
        /([\d\s]+[,\.]\d{3})\s*(?:dt|tnd)$/im, // Montant à la fin avec devise
      ],
      subtotalHt: [
        /(?:sous-?total|subtotal)\s*(?:ht)?\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
        /(?:total\s*ht|ht)\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
        /(?:montant\s*ht)\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
      ],
      taxAmount: [
        /(?:tva|vat|tax)\s*(?:\d+%)?\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
        /(?:montant\s*tva)\s*:?\s*([\d\s]+[,\.]\d{1,3})/i,
      ],
    };

    for (const [key, patterns] of Object.entries(amountPatterns)) {
      for (const pattern of patterns) {
        const match = rawText.match(pattern);
        if (match) {
          mappedFields[key] = this.parseAmount(match[1]);
          this.logger.log(`✓ ${key} trouvé: ${mappedFields[key]} (match: "${match[0]}")`);
          break;
        }
      }
    }

    // Extraction des articles (pattern simple)
    const items: any[] = [];
    const itemPattern = /([A-Za-zÀ-ÿ\s]+?)\s+(\d+(?:[,\.]\d+)?)\s+(\d+(?:[,\.]\d+)?)\s+(\d+(?:[,\.]\d+)?)/g;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(rawText)) !== null) {
      items.push({
        description: itemMatch[1].trim(),
        quantity: parseFloat(itemMatch[2].replace(',', '.')),
        unitPrice: parseFloat(itemMatch[3].replace(',', '.')),
        total: parseFloat(itemMatch[4].replace(',', '.')),
      });
    }
    
    if (items.length > 0) {
      mappedFields.items = items;
      this.logger.log(`✓ ${items.length} articles trouvés`);
    }

    // Déterminer le type de document
    let documentType: 'INVOICE' | 'QUOTE' | 'DELIVERY_NOTE' | 'ORDER' | 'UNKNOWN' = 'UNKNOWN';
    if (/facture|invoice/i.test(rawText)) documentType = 'INVOICE';
    else if (/devis|quote|quotation/i.test(rawText)) documentType = 'QUOTE';
    else if (/bon de livraison|delivery note/i.test(rawText)) documentType = 'DELIVERY_NOTE';
    else if (/commande|order|purchase order/i.test(rawText)) documentType = 'ORDER';

    // Calculer la confiance basée sur les champs extraits
    const fieldsFound = Object.keys(mappedFields).length;
    const confidence = Math.min(100, fieldsFound * 15);

    this.logger.log(`Fallback extraction - ${fieldsFound} champs détectés: ${JSON.stringify(Object.keys(mappedFields))}`);
    this.logger.log(`Montants extraits - HT: ${mappedFields.subtotalHt}, TVA: ${mappedFields.taxAmount}, TTC: ${mappedFields.totalTtc}`);

    return {
      documentType,
      confidence,
      mappedFields,
      rawAiResponse: `Fallback extraction - ${fieldsFound} champs détectés`,
    };
  }

  /**
   * Parse une date au format ISO
   */
  private parseDate(dateStr: string): string {
    try {
      // Supporte DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        
        // Convertir année sur 2 chiffres en 4 chiffres
        if (year.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          year = String(century + parseInt(year));
        }
        
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      this.logger.warn(`Erreur parsing date: ${dateStr}`);
    }
    return dateStr;
  }

  /**
   * Parse un montant en nombre
   */
  private parseAmount(amountStr: string): number {
    try {
      // Enlever les espaces et remplacer virgule par point
      const cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
      return parseFloat(cleaned);
    } catch (error) {
      this.logger.warn(`Erreur parsing montant: ${amountStr}`);
      return 0;
    }
  }
}
