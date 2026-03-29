// src/sales/services/sales-ocr.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { SalesOcrAiService, OcrAiResult } from './sales-ocr-ai.service';

const execFileAsync = promisify(execFile);

export interface SalesDocumentOcrResult {
  document_type: 'invoice' | 'quote' | 'delivery_note' | 'order' | 'unknown';
  document_number: string | null;
  document_date: string | null;
  client_name: string | null;
  client_address: string | null;
  client_tax_id: string | null;
  items: Array<{
    description: string;
    quantity: number | null;
    unit_price: number | null;
    total: number | null;
  }>;
  subtotal_ht: number | null;
  tax_amount: number | null;
  total_ttc: number | null;
  payment_terms: string | null;
  notes: string | null;
  raw_text: string;
  confidence: number;
  processing_time_ms: number;
  // Nouveaux champs AI
  ai_enrichment?: OcrAiResult;
  vision_enrichment?: OcrAiResult;
  suggested_dto?: any;
}

@Injectable()
export class SalesOcrService {
  private readonly logger = new Logger(SalesOcrService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ocrAiService: SalesOcrAiService,
  ) {}

  async extractFromFile(filePath: string): Promise<SalesDocumentOcrResult> {
    const start = Date.now();

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new BadRequestException(`Fichier introuvable : ${filePath}`);
    }

    const ext = path.extname(absolutePath).toLowerCase();
    let imagePath = absolutePath;
    
    if (ext === '.pdf') {
      imagePath = await this.convertPdfToImage(absolutePath);
    }

    const rawText = await this.runTesseract(imagePath);

    if (!rawText || rawText.trim().length < 10) {
      throw new BadRequestException(
        'Aucun texte extrait — vérifiez que l\'image est lisible et nette.',
      );
    }

    const result = this.parseSalesDocument(rawText);
    result.processing_time_ms = Date.now() - start;

    this.logger.log(
      `OCR Sales Document terminé en ${result.processing_time_ms}ms — Type: ${result.document_type}`,
    );

    return result;
  }

  /**
   * Nouvelle méthode avec enrichissement AI
   * Combine Tesseract OCR + Gemini AI pour meilleure précision
   */
  async extractAndEnrich(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<SalesDocumentOcrResult> {
    const start = Date.now();

    // 1. Sauvegarder temporairement le fichier
    const tempDir = path.join(process.cwd(), 'uploads', 'sales-ocr-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const ext = mimeType === 'application/pdf' ? '.pdf' : '.png';
    const tempFile = path.join(tempDir, `temp_${Date.now()}${ext}`);
    fs.writeFileSync(tempFile, fileBuffer);

    try {
      // 2. OCR classique avec Tesseract
      let imagePath = tempFile;
      if (ext === '.pdf') {
        imagePath = await this.convertPdfToImage(tempFile);
      }

      const rawText = await this.runTesseract(imagePath);

      if (!rawText || rawText.trim().length < 10) {
        throw new BadRequestException(
          'Aucun texte extrait — vérifiez que l\'image est lisible et nette.',
        );
      }

      // 3. Parser classique
      const result = this.parseSalesDocument(rawText);

      // 4. Enrichissement avec Gemini AI
      const aiEnrichment = await this.ocrAiService.enrichOcrText(rawText);
      result.ai_enrichment = aiEnrichment;

      // 5. Si image, utiliser aussi Vision API pour confirmation
      if (mimeType.startsWith('image/')) {
        const visionEnrichment = await this.ocrAiService.analyzeImageBuffer(
          fileBuffer,
          mimeType,
        );
        result.vision_enrichment = visionEnrichment;
      }

      // 6. Construire le DTO suggéré basé sur l'enrichissement AI
      result.suggested_dto = this.buildSuggestedDto(aiEnrichment);

      result.processing_time_ms = Date.now() - start;

      this.logger.log(
        `OCR + AI enrichissement terminé en ${result.processing_time_ms}ms — Type: ${result.document_type} (AI: ${aiEnrichment.documentType})`,
      );

      return result;

    } finally {
      // Nettoyer les fichiers temporaires
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        const pngFile = tempFile.replace(ext, '_page1.png');
        if (fs.existsSync(pngFile)) fs.unlinkSync(pngFile);
      } catch (err) {
        this.logger.warn(`Erreur lors du nettoyage des fichiers temporaires: ${err}`);
      }
    }
  }

  /**
   * Construit un DTO pré-rempli basé sur les données AI
   */
  private buildSuggestedDto(aiResult: OcrAiResult): any {
    const fields = aiResult.mappedFields;

    this.logger.log(`Building suggested DTO - Type: ${aiResult.documentType}`);
    this.logger.log(`Mapped fields: ${JSON.stringify(fields)}`);

    if (aiResult.documentType === 'INVOICE') {
      const dto = {
        clientId: null, // À lier manuellement
        documentNumber: fields.documentNumber || null,
        date: fields.date || null,
        dueDate: fields.dueDate || null,
        items: fields.items || [],
        subtotalHt: fields.subtotalHt || null,
        taxAmount: fields.taxAmount || null,
        totalTtc: fields.totalTtc || null,
        notes: fields.notes || null,
      };
      this.logger.log(`Invoice DTO built: ${JSON.stringify(dto)}`);
      return dto;
    }

    if (aiResult.documentType === 'QUOTE') {
      return {
        clientId: null,
        quoteDate: fields.date || null,
        validUntil: fields.dueDate || null,
        items: fields.items || [],
        notes: fields.notes || null,
      };
    }

    if (aiResult.documentType === 'DELIVERY_NOTE') {
      return {
        clientId: null,
        deliveryDate: fields.date || null,
        items: fields.items || [],
        notes: fields.notes || null,
      };
    }

    if (aiResult.documentType === 'ORDER') {
      return {
        clientId: null,
        orderDate: fields.date || null,
        expectedDelivery: fields.dueDate || null,
        items: fields.items || [],
        notes: fields.notes || null,
      };
    }

    this.logger.log(`Unknown document type, returning raw fields`);
    return fields;
  }

  // ─── Tesseract CLI ────────────────────────────────────────────────────────
  private async runTesseract(imagePath: string): Promise<string> {
    const outputBase = imagePath + '_out';
    const tesseractPath = this.config.get<string>(
      'TESSERACT_PATH',
      'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
    );
    const lang = this.config.get<string>('TESSERACT_LANG', 'eng');

    try {
      await execFileAsync(tesseractPath, [
        imagePath,
        outputBase,
        '-l', lang,
        '--psm', '3',
        '--oem', '3',
      ]);

      const outputFile = outputBase + '.txt';
      if (!fs.existsSync(outputFile)) throw new Error('Fichier sortie non généré');

      const text = fs.readFileSync(outputFile, 'utf-8');
      try { fs.unlinkSync(outputFile); } catch {}
      return text;

    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new BadRequestException(
          `Tesseract introuvable à : ${tesseractPath}. Vérifiez TESSERACT_PATH dans .env`,
        );
      }
      throw new BadRequestException(`Erreur Tesseract : ${err.message}`);
    }
  }

  // ─── PDF → Image ──────────────────────────────────────────────────────────
  private async convertPdfToImage(pdfPath: string): Promise<string> {
    const outputPng = pdfPath.replace('.pdf', '_page1.png');
    const popplerPath = this.config.get<string>('POPPLER_PATH', '');
    const pdftoppm = popplerPath
      ? path.join(popplerPath, 'pdftoppm.exe')
      : 'pdftoppm';

    try {
      const base = pdfPath.replace('.pdf', '_p');
      await execFileAsync(pdftoppm, ['-r', '300', '-l', '1', '-png', pdfPath, base]);
      const png1 = base + '-1.png';
      const png2 = base + '-01.png';
      if (fs.existsSync(png1)) return png1;
      if (fs.existsSync(png2)) return png2;
    } catch {}

    try {
      return await this.convertPdfWithPdfjs(pdfPath, outputPng);
    } catch (err: any) {
      this.logger.warn(`pdfjs-dist échoué : ${err.message}`);
    }

    throw new BadRequestException(
      'Impossible de convertir le PDF. Installez Poppler ou uploadez une image.',
    );
  }

  private async convertPdfWithPdfjs(pdfPath: string, outputPng: string): Promise<string> {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdfDoc.getPage(1);

    const scale = 3.0;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPng, buffer);

    this.logger.log(`PDF converti en PNG via pdfjs-dist : ${outputPng}`);
    return outputPng;
  }

  // ─── Parser ───────────────────────────────────────────────────────────────
  private parseSalesDocument(text: string): SalesDocumentOcrResult {
    const cleaned = text
      .replace(/\|/g, 'I')
      .replace(/[""'']/g, '"')
      .replace(/\r\n/g, '\n');

    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

    return {
      document_type: this.detectDocumentType(cleaned),
      document_number: this.extractDocumentNumber(cleaned, lines),
      document_date: this.extractDate(cleaned, lines),
      client_name: this.extractClientName(cleaned, lines),
      client_address: this.extractClientAddress(cleaned, lines),
      client_tax_id: this.extractTaxId(cleaned),
      items: this.extractItems(cleaned, lines),
      subtotal_ht: this.extractAmount(cleaned, [
        /(?:Total?\s*HT|Sous[\s-]?total\s*HT|Montant\s*HT)\s*:?\s*([\d\s.,]+)/i,
      ]),
      tax_amount: this.extractAmount(cleaned, [
        /(?:Total?\s*TVA|Montant\s*TVA|T\.V\.A\.?)\s*:?\s*([\d\s.,]+)/i,
      ]),
      total_ttc: this.extractAmount(cleaned, [
        /(?:Total\s*TTC|Net\s*[àa]\s*[Pp]ayer|Montant\s*TTC)\s*:?\s*([\d\s.,]+)/i,
      ]),
      payment_terms: this.extractPaymentTerms(cleaned),
      notes: this.extractNotes(cleaned, lines),
      raw_text: cleaned,
      confidence: this.computeConfidence(cleaned),
      processing_time_ms: 0,
    };
  }

  private detectDocumentType(text: string): SalesDocumentOcrResult['document_type'] {
    const lower = text.toLowerCase();
    if (/facture|invoice/i.test(text)) return 'invoice';
    if (/devis|quote|quotation/i.test(text)) return 'quote';
    if (/bon\s+de\s+livraison|delivery\s+note|bl\b/i.test(text)) return 'delivery_note';
    if (/commande|order|purchase\s+order/i.test(text)) return 'order';
    return 'unknown';
  }

  private extractDocumentNumber(text: string, lines: string[]): string | null {
    const patterns = [
      /(?:Facture\s*[Nn]°?|FACTURE\s*[Nn]°?|N°\s*[Ff]acture)\s*:?\s*([A-Z0-9\-\/]{3,20})/i,
      /(?:Devis\s*[Nn]°?|DEVIS\s*[Nn]°?|N°\s*[Dd]evis)\s*:?\s*([A-Z0-9\-\/]{3,20})/i,
      /(?:BL\s*[Nn]°?|Bon\s+de\s+livraison\s*[Nn]°?)\s*:?\s*([A-Z0-9\-\/]{3,20})/i,
      /(?:Commande\s*[Nn]°?|Order\s*[Nn]o?\.?)\s*:?\s*([A-Z0-9\-\/]{3,20})/i,
      /\b([A-Z]{2,5}[-\/]\d{4}[-\/]\d{2,6})\b/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1] && m[1].length >= 3) {
        return m[1].toUpperCase().trim();
      }
    }

    return null;
  }

  private extractDate(text: string, lines: string[]): string | null {
    const monthMap: Record<string, string> = {
      janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
      juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
    };

    const patterns = [
      /(?:Date\s*(?:de\s*)?[Ff]acture|Date\s*:|Le\s*:?)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
      /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4})/i,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (!m?.[1]) continue;
      const raw = m[1];
      let iso: string | null = null;

      const written = raw.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (written) {
        const month = monthMap[written[2].toLowerCase()];
        if (month) iso = `${written[3]}-${month}-${written[1].padStart(2, '0')}`;
      } else {
        const parts = raw.split(/[\/\-\.]/);
        if (parts.length === 3 && parts[2].length === 4)
          iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      if (iso && this.isValidDate(iso)) return iso;
    }

    return null;
  }

  private extractClientName(text: string, lines: string[]): string | null {
    const patterns = [
      /(?:Client\s*:|Destinataire\s*:|À\s*:|Pour\s*:)\s*(.+)/i,
      /(?:Société|Entreprise|SARL|SA\b)\s*:?\s*(.+)/i,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const name = m[1].split('\n')[0].trim().substring(0, 100);
        if (name.length >= 3) return name;
      }
    }

    return null;
  }

  private extractClientAddress(text: string, lines: string[]): string | null {
    const patterns = [
      /(?:Adresse\s*:|Address\s*:)\s*(.+?)(?:\n\n|$)/is,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) {
        return m[1].trim().substring(0, 200);
      }
    }

    return null;
  }

  private extractTaxId(text: string): string | null {
    const patterns = [
      /(?:MF|Matricule\s+Fiscal|Tax\s+ID)\s*:?\s*([A-Z0-9\/\-]{7,20})/i,
      /\b(\d{7}[A-Z]{3}\d{3})\b/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].toUpperCase();
    }

    return null;
  }

  private extractItems(text: string, lines: string[]): SalesDocumentOcrResult['items'] {
    const items: SalesDocumentOcrResult['items'] = [];
    const itemPattern = /(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/;

    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match) {
        items.push({
          description: match[1].trim(),
          quantity: parseFloat(match[2].replace(',', '.')),
          unit_price: parseFloat(match[3].replace(',', '.')),
          total: parseFloat(match[4].replace(',', '.')),
        });
      }
    }

    return items;
  }

  private extractAmount(text: string, patterns: RegExp[]): number | null {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(v) && v > 0) return Math.round(v * 1000) / 1000;
      }
    }
    return null;
  }

  private extractPaymentTerms(text: string): string | null {
    const patterns = [
      /(?:Conditions\s+de\s+paiement|Payment\s+terms)\s*:?\s*(.+?)(?:\n|$)/i,
      /(?:Échéance|Due\s+date)\s*:?\s*(.+?)(?:\n|$)/i,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].trim().substring(0, 100);
    }

    return null;
  }

  private extractNotes(text: string, lines: string[]): string | null {
    const patterns = [
      /(?:Notes?|Remarques?|Comments?)\s*:?\s*(.+?)(?:\n\n|$)/is,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].trim().substring(0, 500);
    }

    return null;
  }

  private computeConfidence(text: string): number {
    let score = 0;
    if (/facture|invoice|devis|quote|commande|order/i.test(text)) score += 20;
    if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(text)) score += 20;
    if (/HT|TTC|TVA/i.test(text)) score += 20;
    if (/client|destinataire/i.test(text)) score += 10;
    if (/\d+[,\.]\d{3}/.test(text)) score += 10;
    if (text.length > 200) score += 10;
    if (text.length > 500) score += 10;
    return Math.min(100, score);
  }

  private isValidDate(iso: string): boolean {
    const d = new Date(iso);
    return !isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2035;
  }
}
