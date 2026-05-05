// src/Purchases/services/po-ai-generator.service.ts
//
// Génération de Bon de Commande par IA à partir de texte naturel
// Exemple: "Commander 500 kg de farine chez Ali Boulangerie pour le 15 avril"

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { parseGeminiJson } from '../utils/json-parser.util';

interface ParsedPORequest {
  productName: string;
  quantity: number;
  unit: string;
  supplierName: string;
  deliveryDate: string | null;
  estimatedPrice: number | null;
  notes: string | null;
}

export interface GeneratedPO {
  supplier_id: string;
  supplier_name: string;
  delivery_date: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price_ht: number;
    tax_rate_value: number;
  }>;
  notes: string;
  confidence: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

@Injectable()
export class PoAiGeneratorService {
  private readonly logger = new Logger(PoAiGeneratorService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
  }

  /**
   * Génère un BC à partir d'une commande en texte naturel
   */
  async generateFromText(businessId: string, text?: string): Promise<GeneratedPO> {
    const start = Date.now();

    this.logger.log(`🔍 [Service] generateFromText appelé`);
    this.logger.log(`🔍 [Service] businessId: ${businessId}`);
    this.logger.log(`🔍 [Service] text reçu: "${text}"`);
    this.logger.log(`🔍 [Service] type de text: ${typeof text}`);
    this.logger.log(`🔍 [Service] text est undefined: ${text === undefined}`);
    this.logger.log(`🔍 [Service] text est null: ${text === null}`);
    this.logger.log(`🔍 [Service] text est vide: ${text === ''}`);

    if (!this.apiKey) {
      throw new BadRequestException('GEMINI_API_KEY non configurée. Impossible de générer le BC par IA.');
    }

    // Vérifier que le texte est présent
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestException('Veuillez saisir une description de votre commande.');
    }

    const trimmedText = text.trim();
    this.logger.log(`🔍 [Service] trimmedText utilisé: "${trimmedText}"`);
    this.logger.log(`🔍 [Service] longueur après trim: ${trimmedText.length}`);

    try {
      // 1. Parser le texte avec l'IA
      const parsed = await this.parseTextWithAI(trimmedText);
      this.logger.log(`✅ Texte parsé avec succès:`);
      this.logger.log(`   - Produit: ${parsed.productName}`);
      this.logger.log(`   - Quantité: ${parsed.quantity} ${parsed.unit}`);
      this.logger.log(`   - Fournisseur: ${parsed.supplierName}`);
      this.logger.log(`   - Prix unitaire: ${parsed.estimatedPrice || 'non spécifié'}`);
      this.logger.log(`   - Date livraison: ${parsed.deliveryDate || 'non spécifiée'}`);

      // 2. Rechercher le fournisseur
      const supplier = await this.findSupplier(businessId, parsed.supplierName);
      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur "${parsed.supplierName}" introuvable. Créez-le d'abord ou vérifiez l'orthographe.`,
        );
      }

      // 3. Utiliser le prix estimé par l'IA ou un prix par défaut
      const unitPrice = parsed.estimatedPrice && parsed.estimatedPrice > 0 ? parsed.estimatedPrice : 10.0;
      const taxRate = 19;

      this.logger.log(`💰 Prix unitaire utilisé: ${unitPrice} TND`);

      // 4. Calculer la date de livraison
      const deliveryDate = parsed.deliveryDate || this.getDefaultDeliveryDate();

      // 5. Construire le BC
      const quantity = parsed.quantity || 1;
      const unit = parsed.unit || 'unité';
      const productName = parsed.productName || 'Produit';
      
      // Description complète avec nom, quantité et unité
      const description = `${productName} - ${quantity} ${unit}`;

      const generatedPO: GeneratedPO = {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        delivery_date: deliveryDate,
        items: [
          {
            description: description,
            quantity: quantity,
            unit_price_ht: unitPrice,
            tax_rate_value: taxRate,
          },
        ],
        notes: parsed.notes || `Généré automatiquement depuis: "${trimmedText}"`,
        confidence: 85,
      };

      const totalHT = unitPrice * quantity;
      const totalTTC = totalHT * (1 + taxRate / 100);

      this.logger.log(
        `✅ BC généré en ${Date.now() - start}ms — Fournisseur: ${supplier.name}, Produit: ${productName}, Qté: ${quantity} ${unit}, Prix unitaire: ${unitPrice} TND, Total TTC: ${totalTTC.toFixed(3)} TND`,
      );

      return generatedPO;
    } catch (error: any) {
      this.logger.error(`Erreur génération BC: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse le texte avec Gemini (avec retry automatique) + fallback regex
   */
  private async parseTextWithAI(text: string, retryCount = 0): Promise<ParsedPORequest> {
    const maxRetries = 3;
    const retryDelay = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s

    // Essayer d'abord le parsing manuel par regex (rapide et fiable)
    const manualResult = this.parseTextManually(text);
    this.logger.log(`🔧 Parsing manuel pour: "${text}"`);
    this.logger.log(`🔧 Résultat manuel: ${JSON.stringify(manualResult)}`);
    const hasAllFields = manualResult.productName && manualResult.quantity && manualResult.supplierName;

    const prompt = `Analyse cette commande d'achat et retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après.

COMMANDE: "${text}"

Retourne ce JSON exact avec les valeurs extraites (remplace null par la vraie valeur si trouvée):
{"productName":"NOM_PRODUIT","quantity":NOMBRE,"unit":"UNITE","supplierName":"NOM_FOURNISSEUR","deliveryDate":"YYYY-MM-DD","estimatedPrice":PRIX,"notes":null}

RÈGLES STRICTES:
- productName: le nom du produit/article (ex: "Farine", "Sucre", "Huile")
- quantity: nombre entier ou décimal (ex: 500, 100, 50.5)
- unit: unité de mesure (ex: "kg", "litre", "unité", "g", "tonne")
- supplierName: nom du fournisseur après "chez" (ex: "Imenn", "Ali Boulangerie")
- deliveryDate: date au format YYYY-MM-DD, année 2026 si non précisée (ex: "2026-04-15")
- estimatedPrice: prix unitaire en nombre (ex: 20 pour "20dt le kg", 15.5 pour "15.5 TND")
- notes: null

EXEMPLE:
Commande: "Commander 500 kg de farine chez Imenn pour le 15 avril à 20dt le kg"
Réponse: {"productName":"Farine","quantity":500,"unit":"kg","supplierName":"Imenn","deliveryDate":"2026-04-15","estimatedPrice":20,"notes":null}`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 503 && retryCount < maxRetries) {
          this.logger.warn(`⚠️ Gemini 503 (tentative ${retryCount + 1}/${maxRetries}). Retry dans ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.parseTextWithAI(text, retryCount + 1);
        }
        if (response.status === 503) {
          this.logger.warn(`⚠️ Gemini indisponible après ${maxRetries} tentatives. Utilisation du parsing manuel.`);
          if (hasAllFields) return manualResult as ParsedPORequest;
          throw new BadRequestException(`L'API IA est temporairement indisponible. Réessayez dans quelques instants.`);
        }
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data: GeminiResponse = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      this.logger.log(`🤖 Réponse brute Gemini: ${aiText}`);

      if (!aiText) {
        this.logger.warn('Réponse Gemini vide, utilisation du parsing manuel');
        if (hasAllFields) return manualResult as ParsedPORequest;
        throw new Error('Réponse Gemini vide');
      }

      // Tenter le parsing JSON de la réponse Gemini
      let parsed: ParsedPORequest | null = null;
      try {
        const raw = parseGeminiJson(aiText);
        // Vérifier que les champs essentiels sont présents et non-null/vides
        if (raw.productName && raw.quantity && raw.supplierName) {
          parsed = raw as ParsedPORequest;
          this.logger.log(`✅ Gemini a parsé avec succès: ${JSON.stringify(parsed)}`);
        } else {
          this.logger.warn(`⚠️ Gemini a retourné des champs vides/null: ${JSON.stringify(raw)}`);
        }
      } catch (e) {
        this.logger.warn(`⚠️ Erreur parsing JSON Gemini: ${e}`);
      }

      // Si Gemini a échoué, utiliser le parsing manuel
      if (!parsed) {
        this.logger.log(`🔧 Fallback vers parsing manuel pour: "${text}"`);
        if (hasAllFields) {
          this.logger.log(`✅ Parsing manuel réussi: ${JSON.stringify(manualResult)}`);
          return manualResult as ParsedPORequest;
        }
        throw new BadRequestException(
          `Impossible d'extraire les informations. Utilisez ce format: "Commander 500 kg de farine chez NomFournisseur pour le 15 avril à 20dt le kg"`
        );
      }

      return parsed;

    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      // Dernier recours: parsing manuel
      this.logger.warn(`⚠️ Erreur Gemini: ${error.message}. Tentative parsing manuel.`);
      if (hasAllFields) {
        this.logger.log(`✅ Parsing manuel réussi: ${JSON.stringify(manualResult)}`);
        return manualResult as ParsedPORequest;
      }
      throw new BadRequestException(
        `Erreur IA: ${error.message}. Utilisez ce format: "Commander 500 kg de farine chez NomFournisseur"`
      );
    }
  }

  /**
   * Parsing manuel par regex comme fallback si Gemini échoue
   * Gère les formats: "Commander 500 kg de farine chez Imenn pour le 15 avril à 20dt le kg"
   */
  private parseTextManually(text: string): Partial<ParsedPORequest> {
    const result: Partial<ParsedPORequest> = {};

    // ── Quantité + unité ──────────────────────────────────────────────────────
    // Ex: "500 kg", "100 unités", "50 litres", "2 tonnes"
    const qtyMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|tonne|tonnes|litre|litres|l|unité|unites|unités|pièce|pieces|pièces|boite|boîte|carton|sac|palette|ml|cl)/i);
    if (qtyMatch) {
      result.quantity = parseFloat(qtyMatch[1].replace(',', '.'));
      result.unit = qtyMatch[2].toLowerCase().replace('tonnes', 'tonne').replace('litres', 'litre').replace('pièces', 'pièce');
    }

    // ── Produit ───────────────────────────────────────────────────────────────
    // Cherche le mot après "de/d'" et avant "chez/pour/à/au"
    // Ex: "de farine chez" → "farine"
    const productPatterns = [
      /(?:de|d')\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{1,30}?)\s+(?:chez|pour|à|au|aux)\b/i,
      /(?:de|d')\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{1,30}?)\s*$/i,
    ];
    for (const pattern of productPatterns) {
      const m = text.match(pattern);
      if (m) {
        result.productName = m[1].trim();
        // Capitaliser la première lettre
        result.productName = result.productName.charAt(0).toUpperCase() + result.productName.slice(1);
        break;
      }
    }

    // ── Fournisseur ───────────────────────────────────────────────────────────
    // Cherche après "chez" jusqu'à "pour/le/à/par/$"
    const supplierMatch = text.match(/chez\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{0,40}?)(?:\s+pour|\s+le\s+\d|\s+à|\s+par|\s*$)/i);
    if (supplierMatch) {
      result.supplierName = supplierMatch[1].trim();
    }

    // ── Prix ──────────────────────────────────────────────────────────────────
    // Ex: "20dt le kg", "20 TND", "à 20dt", "par 20dt", "de 20dt"
    const pricePatterns = [
      /(?:à|par|de|au prix de|prix)\s*(\d+(?:[.,]\d+)?)\s*(?:dt|dinar|tnd|dinars)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:dt|dinar|tnd|dinars)\s+(?:le|la|l'|par)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:dt|dinar|tnd|dinars)/i,
    ];
    for (const pattern of pricePatterns) {
      const m = text.match(pattern);
      if (m) {
        result.estimatedPrice = parseFloat(m[1].replace(',', '.'));
        break;
      }
    }

    // ── Date ──────────────────────────────────────────────────────────────────
    const months: Record<string, string> = {
      'janvier': '01', 'fevrier': '02', 'février': '02', 'mars': '03',
      'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
      'aout': '08', 'août': '08', 'septembre': '09', 'octobre': '10',
      'novembre': '11', 'decembre': '12', 'décembre': '12'
    };
    const dateMatch = text.match(/(?:le|pour le|avant le)\s+(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)/i);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthKey = dateMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const month = months[dateMatch[2].toLowerCase()] || months[monthKey] || '01';
      result.deliveryDate = `2026-${month}-${day}`;
    }

    this.logger.log(`🔧 Parsing manuel résultat: productName="${result.productName}", quantity=${result.quantity}, unit="${result.unit}", supplier="${result.supplierName}", price=${result.estimatedPrice}, date=${result.deliveryDate}`);
    return result;
  }

  /**
   * Recherche un fournisseur par nom (fuzzy search)
   */
  private async findSupplier(businessId: string, name: string): Promise<Supplier | null> {
    // Recherche exacte
    let supplier = await this.supplierRepo.findOne({
      where: { business_id: businessId, name },
    });

    if (supplier) return supplier;

    // Recherche partielle (contient)
    supplier = await this.supplierRepo.findOne({
      where: { business_id: businessId, name: Like(`%${name}%`) },
    });

    if (supplier) return supplier;

    // Recherche inversée (le nom contient la recherche)
    const suppliers = await this.supplierRepo.find({
      where: { business_id: businessId },
    });

    for (const s of suppliers) {
      if (s.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(s.name.toLowerCase())) {
        return s;
      }
    }

    return null;
  }

  /**
   * Date de livraison par défaut (dans 7 jours)
   */
  private getDefaultDeliveryDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }
}
