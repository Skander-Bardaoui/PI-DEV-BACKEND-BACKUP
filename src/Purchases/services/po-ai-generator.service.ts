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
  async generateFromText(businessId: string, text: string): Promise<GeneratedPO> {
    const start = Date.now();

    if (!this.apiKey) {
      throw new BadRequestException('GEMINI_API_KEY non configurée. Impossible de générer le BC par IA.');
    }

    if (!text || text.trim().length < 10) {
      throw new BadRequestException('Le texte de commande est trop court (minimum 10 caractères).');
    }

    try {
      // 1. Parser le texte avec l'IA
      const parsed = await this.parseTextWithAI(text);
      this.logger.log(`Texte parsé: ${JSON.stringify(parsed)}`);

      // 2. Rechercher le fournisseur
      const supplier = await this.findSupplier(businessId, parsed.supplierName);
      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur "${parsed.supplierName}" introuvable. Créez-le d'abord ou vérifiez l'orthographe.`,
        );
      }

      // 3. Utiliser le prix estimé par l'IA ou un prix par défaut
      const unitPrice = parsed.estimatedPrice || 10.0;
      const taxRate = 19;

      // 4. Calculer la date de livraison
      const deliveryDate = parsed.deliveryDate || this.getDefaultDeliveryDate();

      // 5. Construire le BC
      const generatedPO: GeneratedPO = {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        delivery_date: deliveryDate,
        items: [
          {
            description: `${parsed.productName} (${parsed.quantity} ${parsed.unit})`,
            quantity: parsed.quantity,
            unit_price_ht: unitPrice,
            tax_rate_value: taxRate,
          },
        ],
        notes: parsed.notes || `Généré automatiquement depuis: "${text}"`,
        confidence: 85,
      };

      this.logger.log(
        `BC généré en ${Date.now() - start}ms — Fournisseur: ${supplier.name}, Produit: ${parsed.productName}, Qté: ${parsed.quantity}`,
      );

      return generatedPO;
    } catch (error: any) {
      this.logger.error(`Erreur génération BC: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse le texte avec Gemini
   */
  private async parseTextWithAI(text: string): Promise<ParsedPORequest> {
    const prompt = `Tu es un assistant de gestion d'achats. Analyse cette commande en langage naturel et extrais les informations structurées.

COMMANDE:
"${text}"

TÂCHES:
1. Identifie le nom du produit/article commandé
2. Identifie la quantité et l'unité (kg, unités, litres, etc.)
3. Identifie le nom du fournisseur
4. Identifie la date de livraison souhaitée (format YYYY-MM-DD)
5. Estime un prix unitaire HT raisonnable en TND (optionnel)
6. Extrais toute note ou information supplémentaire

RÈGLES:
- Si la date n'est pas mentionnée, retourne null
- Si l'unité n'est pas mentionnée, utilise "unité"
- Si le prix n'est pas mentionné, retourne null
- Sois flexible avec les variations de langage (commander, acheter, prendre, etc.)
- Accepte les dates en français (15 avril → 2024-04-15)

RÉPONDS UNIQUEMENT EN JSON (sans markdown):
{
  "productName": "nom du produit",
  "quantity": nombre,
  "unit": "kg/unité/litre/etc",
  "supplierName": "nom du fournisseur",
  "deliveryDate": "YYYY-MM-DD ou null",
  "estimatedPrice": nombre ou null,
  "notes": "notes supplémentaires ou null"
}`;

    const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiResponse = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      throw new Error('Réponse Gemini vide');
    }

    // Parser avec l'utilitaire robuste
    let parsed: ParsedPORequest;
    
    try {
      parsed = parseGeminiJson(aiText);
    } catch (parseError: any) {
      this.logger.error(`Erreur parsing: ${parseError.message}`);
      throw new BadRequestException(
        'Impossible de comprendre la réponse IA. Reformulez votre commande plus simplement (ex: "Commander 100 kg de farine chez NomFournisseur").',
      );
    }

    // Validation
   /* if (!parsed.productName || !parsed.quantity || !parsed.supplierName) {
      throw new BadRequestException(
        'Impossible d\'extraire les informations essentielles. Vérifiez que vous mentionnez : produit, quantité et fournisseur.',
      );
    }
*/
    return parsed;
    return parsed;
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
