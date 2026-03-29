// src/Purchases/services/three-way-matching-ai.service.ts
//
// Service IA pour améliorer le rapprochement 3 voies avec analyse intelligente
// et gestion claire des litiges

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

import { LineDiscrepancy, MatchStatus, ThreeWayMatchResult } from './three-way-matching.service';
import { parseGeminiJson } from '../utils/json-parser.util';

// ─── Types pour l'analyse IA ─────────────────────────────────────────────────

export interface AIMatchingAnalysis {
  confidence_score:      number;        // 0-100 : confiance dans la décision
  risk_level:            'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_action:    'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'AUTO_DISPUTE' | 'CONTACT_SUPPLIER';
  explanation:           string;        // Explication claire en français
  key_findings:          string[];      // Points clés identifiés
  suggested_next_steps:  string[];      // Actions concrètes à prendre
  dispute_category:      DisputeCategory | null;
  estimated_resolution_time: string;    // Ex: "2-3 jours ouvrés"
}

export enum DisputeCategory {
  PRICE_DISCREPANCY    = 'PRICE_DISCREPANCY',     // Écart de prix
  QUANTITY_MISMATCH    = 'QUANTITY_MISMATCH',     // Écart de quantité
  MISSING_DELIVERY     = 'MISSING_DELIVERY',      // Livraison manquante
  PARTIAL_DELIVERY     = 'PARTIAL_DELIVERY',      // Livraison partielle
  QUALITY_ISSUE        = 'QUALITY_ISSUE',         // Problème de qualité
  DUPLICATE_INVOICE    = 'DUPLICATE_INVOICE',     // Facture en double
  UNAUTHORIZED_CHARGE  = 'UNAUTHORIZED_CHARGE',   // Frais non autorisés
  CALCULATION_ERROR    = 'CALCULATION_ERROR',     // Erreur de calcul
}

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  [DisputeCategory.PRICE_DISCREPANCY]:    'Écart de prix unitaire',
  [DisputeCategory.QUANTITY_MISMATCH]:    'Écart de quantité',
  [DisputeCategory.MISSING_DELIVERY]:     'Livraison non reçue',
  [DisputeCategory.PARTIAL_DELIVERY]:     'Livraison partielle',
  [DisputeCategory.QUALITY_ISSUE]:        'Problème de qualité',
  [DisputeCategory.DUPLICATE_INVOICE]:    'Facture en double',
  [DisputeCategory.UNAUTHORIZED_CHARGE]:  'Frais non autorisés',
  [DisputeCategory.CALCULATION_ERROR]:    'Erreur de calcul',
};

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Injectable()
export class ThreeWayMatchingAIService {

  private readonly logger = new Logger(ThreeWayMatchingAIService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — analyse IA désactivée');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analyse IA du résultat de rapprochement
  // ─────────────────────────────────────────────────────────────────────────
  async analyzeMatching(result: ThreeWayMatchResult): Promise<AIMatchingAnalysis> {
    if (!this.apiKey) {
      return this.getFallbackAnalysis(result);
    }

    try {
      const prompt = this.buildAnalysisPrompt(result);
      
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            topP: 0.8,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${err}`);
      }

      const data: GeminiResponse = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) {
        throw new Error('Réponse IA vide');
      }

      const analysis = this.parseAIResponse(aiText, result);
      this.logger.log(`Analyse IA complétée pour facture ${result.invoice_number} — Confiance: ${analysis.confidence_score}%`);
      
      return analysis;

    } catch (error: any) {
      this.logger.error(`Erreur analyse IA : ${error.message}`);
      return this.getFallbackAnalysis(result);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Construction du prompt pour Claude
  // ─────────────────────────────────────────────────────────────────────────
  private buildAnalysisPrompt(result: ThreeWayMatchResult): string {
    return `Tu es un expert comptable tunisien spécialisé dans le rapprochement des factures fournisseurs.

Analyse ce rapprochement 3 voies (Bon de Commande ↔ Bon de Réception ↔ Facture) et fournis une recommandation claire.

DONNÉES DU RAPPROCHEMENT :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Facture : ${result.invoice_number}
Fournisseur : ${result.supplier_name}
Bon de Commande : ${result.po_number || 'NON ASSOCIÉ'}
Bons de Réception : ${result.gr_numbers.length > 0 ? result.gr_numbers.join(', ') : 'AUCUN'}

MONTANTS :
• Montant commandé (BC) : ${result.po_total.toFixed(3)} TND
• Montant réceptionné (BR) : ${result.received_total.toFixed(3)} TND
• Montant facturé : ${result.invoiced_total.toFixed(3)} TND
• Écart total : ${result.total_discrepancy.toFixed(3)} TND (${result.discrepancy_pct.toFixed(2)}%)

STATUT ACTUEL : ${result.status}

PROBLÈMES IDENTIFIÉS :
${result.issues.length > 0 ? result.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n') : '• Aucun problème détecté'}

DÉTAIL PAR LIGNE :
${result.line_discrepancies.map((line, i) => `
Ligne ${i + 1} : ${line.description}
  • Commandé : ${line.po_quantity} × ${line.po_unit_price.toFixed(3)} TND = ${line.po_line_total.toFixed(3)} TND
  • Reçu : ${line.received_quantity}
  • Écart : ${line.discrepancy_amount.toFixed(3)} TND (${line.discrepancy_pct.toFixed(2)}%)
  • Statut : ${line.status}
`).join('\n')}

CONTEXTE COMPTABLE TUNISIEN :
• Tolérance standard : 0,5% (écarts mineurs acceptables)
• Timbre fiscal : 1,000 TND obligatoire
• Livraisons partielles : acceptables si facture correspond à la réception
• Écarts > 5% : nécessitent investigation obligatoire

INSTRUCTIONS :
Fournis une analyse JSON avec cette structure EXACTE :
{
  "confidence_score": <0-100>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "recommended_action": "<AUTO_APPROVE|MANUAL_REVIEW|AUTO_DISPUTE|CONTACT_SUPPLIER>",
  "explanation": "<explication claire en 2-3 phrases>",
  "key_findings": ["<point clé 1>", "<point clé 2>", ...],
  "suggested_next_steps": ["<action 1>", "<action 2>", ...],
  "dispute_category": "<catégorie ou laisser vide si aucune>",
  "estimated_resolution_time": "<durée estimée>"
}

IMPORTANT : 
- Pour dispute_category, utilise une des catégories listées ci-dessous OU laisse une chaîne vide "" si aucun litige
- N'utilise JAMAIS le mot "null" - utilise "" à la place
- Assure-toi que toutes les chaînes sont entre guillemets doubles
- N'inclus AUCUN saut de ligne dans les valeurs de chaînes

CATÉGORIES DE LITIGE DISPONIBLES :
• PRICE_DISCREPANCY : écart de prix unitaire
• QUANTITY_MISMATCH : écart de quantité
• MISSING_DELIVERY : livraison non reçue
• PARTIAL_DELIVERY : livraison partielle
• QUALITY_ISSUE : problème de qualité
• DUPLICATE_INVOICE : facture en double
• UNAUTHORIZED_CHARGE : frais non autorisés
• CALCULATION_ERROR : erreur de calcul

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Parser la réponse de Claude
  // ─────────────────────────────────────────────────────────────────────────
  private parseAIResponse(text: string, result: ThreeWayMatchResult): AIMatchingAnalysis {
    try {
      // Utiliser l'utilitaire de parsing Gemini
      const parsed = parseGeminiJson(text);

      return {
        confidence_score:         Math.min(100, Math.max(0, parsed.confidence_score || 0)),
        risk_level:               parsed.risk_level || 'MEDIUM',
        recommended_action:       parsed.recommended_action || 'MANUAL_REVIEW',
        explanation:              parsed.explanation || 'Analyse en cours...',
        key_findings:             Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
        suggested_next_steps:     Array.isArray(parsed.suggested_next_steps) ? parsed.suggested_next_steps : [],
        dispute_category:         (parsed.dispute_category && parsed.dispute_category !== '') ? parsed.dispute_category : null,
        estimated_resolution_time: parsed.estimated_resolution_time || '1-2 jours ouvrés',
      };

    } catch (error: any) {
      this.logger.error(`Erreur parsing réponse IA : ${error.message}`);
      return this.getFallbackAnalysis(result);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analyse de secours (sans IA) - PUBLIC pour utilisation directe
  // ─────────────────────────────────────────────────────────────────────────
  public getFallbackAnalysis(result: ThreeWayMatchResult): AIMatchingAnalysis {
    const discrepancyPct = result.discrepancy_pct;
    const hasIssues = result.issues.length > 0;

    let confidence_score = 100;
    let risk_level: AIMatchingAnalysis['risk_level'] = 'LOW';
    let recommended_action: AIMatchingAnalysis['recommended_action'] = 'AUTO_APPROVE';
    let explanation = '';
    let key_findings: string[] = [];
    let suggested_next_steps: string[] = [];
    let dispute_category: DisputeCategory | null = null;
    let estimated_resolution_time = '1 jour ouvré';

    // Analyse basée sur les règles métier
    if (result.status === MatchStatus.MISSING_PO) {
      confidence_score = 0;
      risk_level = 'CRITICAL';
      recommended_action = 'MANUAL_REVIEW';
      explanation = 'Aucun bon de commande associé à cette facture. Impossible de valider sans BC.';
      key_findings = ['Facture sans bon de commande', 'Risque de fraude ou erreur administrative'];
      suggested_next_steps = [
        'Vérifier si un BC existe pour cette commande',
        'Contacter le fournisseur pour clarification',
        'Associer le BC correspondant avant approbation',
      ];
      dispute_category = DisputeCategory.UNAUTHORIZED_CHARGE;
      estimated_resolution_time = '2-3 jours ouvrés';

    } else if (result.status === MatchStatus.MISSING_GR) {
      confidence_score = 20;
      risk_level = 'HIGH';
      recommended_action = 'MANUAL_REVIEW';
      explanation = 'Aucun bon de réception enregistré. Attendre la confirmation de livraison avant approbation.';
      key_findings = ['Marchandises non réceptionnées', 'Risque de paiement anticipé'];
      suggested_next_steps = [
        'Vérifier si les marchandises ont été livrées',
        'Créer le bon de réception correspondant',
        'Contacter le service logistique',
      ];
      dispute_category = DisputeCategory.MISSING_DELIVERY;
      estimated_resolution_time = '3-5 jours ouvrés';

    } else if (result.status === MatchStatus.OVER_INVOICED) {
      confidence_score = 10;
      risk_level = 'CRITICAL';
      recommended_action = 'AUTO_DISPUTE';
      explanation = `Le montant facturé dépasse ce qui a été reçu de ${Math.abs(result.total_discrepancy).toFixed(3)} TND. Litige requis.`;
      key_findings = [
        `Surfacturation de ${Math.abs(result.total_discrepancy).toFixed(3)} TND`,
        'Écart non justifié par rapport à la réception',
      ];
      suggested_next_steps = [
        'Contacter immédiatement le fournisseur',
        'Demander une facture rectificative (avoir)',
        'Bloquer le paiement jusqu\'à résolution',
      ];
      dispute_category = DisputeCategory.PRICE_DISCREPANCY;
      estimated_resolution_time = '5-7 jours ouvrés';

    } else if (discrepancyPct > 5) {
      confidence_score = 30;
      risk_level = 'HIGH';
      recommended_action = 'AUTO_DISPUTE';
      explanation = `Écart significatif de ${discrepancyPct.toFixed(2)}% détecté. Investigation requise.`;
      key_findings = result.issues.slice(0, 3);
      suggested_next_steps = [
        'Analyser les écarts ligne par ligne',
        'Vérifier les prix unitaires avec le BC',
        'Contacter le fournisseur pour clarification',
      ];
      dispute_category = this.detectDisputeCategory(result);
      estimated_resolution_time = '3-5 jours ouvrés';

    } else if (discrepancyPct > 0.5 && discrepancyPct <= 5) {
      confidence_score = 70;
      risk_level = 'MEDIUM';
      recommended_action = 'MANUAL_REVIEW';
      explanation = `Écart mineur de ${discrepancyPct.toFixed(2)}% détecté. Vérification manuelle recommandée.`;
      key_findings = ['Écart dans la tolérance étendue', 'Peut être dû à des arrondis ou frais mineurs'];
      suggested_next_steps = [
        'Vérifier les calculs de TVA et timbre fiscal',
        'Comparer avec les conditions du BC',
        'Approuver si justifié, sinon contacter le fournisseur',
      ];
      estimated_resolution_time = '1-2 jours ouvrés';

    } else if (result.received_total < result.po_total && discrepancyPct <= 0.5) {
      // Livraison partielle mais facture correcte
      confidence_score = 90;
      risk_level = 'LOW';
      recommended_action = 'AUTO_APPROVE';
      explanation = 'Livraison partielle : la facture correspond exactement à ce qui a été reçu. Approbation possible.';
      key_findings = [
        'Facture conforme à la réception',
        'Livraison partielle normale',
        `Reste à recevoir : ${(result.po_total - result.received_total).toFixed(3)} TND`,
      ];
      suggested_next_steps = [
        'Approuver cette facture',
        'Suivre la livraison du solde de la commande',
      ];
      dispute_category = DisputeCategory.PARTIAL_DELIVERY;

    } else {
      // Tout correspond parfaitement
      confidence_score = 100;
      risk_level = 'LOW';
      recommended_action = 'AUTO_APPROVE';
      explanation = 'Rapprochement validé : tous les montants correspondent. Approbation automatique recommandée.';
      key_findings = [
        'Facture conforme au bon de commande',
        'Marchandises réceptionnées et vérifiées',
        'Aucun écart détecté',
      ];
      suggested_next_steps = ['Approuver et planifier le paiement'];
    }

    return {
      confidence_score,
      risk_level,
      recommended_action,
      explanation,
      key_findings,
      suggested_next_steps,
      dispute_category,
      estimated_resolution_time,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Détecter la catégorie de litige
  // ─────────────────────────────────────────────────────────────────────────
  private detectDisputeCategory(result: ThreeWayMatchResult): DisputeCategory | null {
    const lines = result.line_discrepancies;

    if (lines.some(l => l.status === 'OVER_INVOICED')) {
      return DisputeCategory.QUANTITY_MISMATCH;
    }
    if (lines.some(l => l.status === 'NOT_RECEIVED')) {
      return DisputeCategory.MISSING_DELIVERY;
    }
    if (lines.some(l => l.status === 'PRICE_MISMATCH')) {
      return DisputeCategory.PRICE_DISCREPANCY;
    }
    if (lines.some(l => l.status === 'QTY_MISMATCH')) {
      return DisputeCategory.QUANTITY_MISMATCH;
    }
    if (result.received_total < result.po_total) {
      return DisputeCategory.PARTIAL_DELIVERY;
    }

    return DisputeCategory.CALCULATION_ERROR;
  }
}
