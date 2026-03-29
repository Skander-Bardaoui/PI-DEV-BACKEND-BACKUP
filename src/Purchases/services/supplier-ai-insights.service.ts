// src/Purchases/services/supplier-ai-insights.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupplierScore } from './supplier-scoring.service';
import { parseGeminiJson } from '../utils/json-parser.util';

export interface RiskPrediction {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  risk_factors: string[];
  predicted_issues: string[];
  confidence: number;
}

export interface ActionRecommendation {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action_type: 'negotiate' | 'diversify' | 'reward' | 'monitor' | 'terminate' | 'optimize';
  title: string;
  description: string;
  expected_impact: string;
  estimated_savings?: number;
}

export interface PatternInsight {
  pattern_type: 'trend' | 'anomaly' | 'seasonality' | 'correlation';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data_points: string[];
}

export interface BenchmarkComparison {
  metric: string;
  supplier_value: number;
  industry_average: number;
  top_quartile: number;
  performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  gap_analysis: string;
}

export interface SupplierAIInsights {
  supplier_id: string;
  supplier_name: string;
  analysis_date: Date;
  risk_prediction: RiskPrediction;
  recommendations: ActionRecommendation[];
  patterns: PatternInsight[];
  benchmarks: BenchmarkComparison[];
  ai_summary: string;
  executive_summary: string;        // ← nouveau : 1 phrase percutante
  key_strength: string;             // ← nouveau : point fort principal
  key_weakness: string;             // ← nouveau : point faible principal
  analysis_confidence: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Injectable()
export class SupplierAiInsightsService {
  private readonly logger = new Logger(SupplierAiInsightsService.name);
  private readonly apiKey: string;
  private readonly apiUrl =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';


  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
  }

  // ─── Public ───────────────────────────────────────────────────────────────
  async generateInsights(
    supplierScore: SupplierScore,
    historicalData?: any,
  ): Promise<SupplierAIInsights> {
    const start = Date.now();

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — analyse basique');
      return this.generateBasicInsights(supplierScore);
    }

    try {
      const result = await this.analyzeWithAI(supplierScore, historicalData);
      this.logger.log(
        `Insights IA générés en ${Date.now() - start}ms pour "${supplierScore.supplier_name}" (confiance: ${result.analysis_confidence}%)`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Erreur analyse IA: ${error.message}`);
      return this.generateBasicInsights(supplierScore);
    }
  }

  // ─── Analyse IA ───────────────────────────────────────────────────────────
  private async analyzeWithAI(
    score: SupplierScore,
    _historicalData?: any,
  ): Promise<SupplierAIInsights> {

    // Calcul des signaux critiques pour orienter l'IA
    const criticalCriteria = score.criteria.filter(c => c.score < 40);
    const strongCriteria   = score.criteria.filter(c => c.score >= 85);
    const hasDisputes      = score.stats.dispute_rate_pct > 5;
    const hasDelays        = score.stats.on_time_rate_pct < 80;
    const paymentHealthy   = score.stats.payment_rate_pct >= 90;

    const prompt = `Tu es un directeur des achats senior avec 20 ans d'expérience en Tunisie et en Afrique du Nord.
Analyse ce fournisseur et produis des insights actionnables, précis et percutants.

═══ FICHE FOURNISSEUR ═══
Nom: ${score.supplier_name}
Score global: ${score.total_score}/100 | Grade: ${score.grade}
${score.total_score >= 85 ? '⭐ FOURNISSEUR STRATÉGIQUE' : score.total_score < 40 ? '🚨 FOURNISSEUR EN DANGER' : ''}

═══ PERFORMANCE PAR CRITÈRE ═══
${score.criteria.map(c => {
  const status = c.score >= 85 ? '✅' : c.score >= 60 ? '⚠️' : '❌';
  return `${status} ${c.name} (poids ${c.weight}%): ${c.score}/100 → ${c.label}`;
}).join('\n')}

${criticalCriteria.length > 0 ? `\n🚨 CRITÈRES CRITIQUES: ${criticalCriteria.map(c => c.name).join(', ')}` : ''}
${strongCriteria.length > 0   ? `\n💪 POINTS FORTS: ${strongCriteria.map(c => c.name).join(', ')}` : ''}

═══ DONNÉES OPÉRATIONNELLES ═══
📦 Commandes: ${score.stats.total_pos} BC | ${score.stats.confirmed_pos} confirmés | délai moy: ${score.stats.avg_confirmation_days}j
🚚 Livraisons: ${score.stats.delivery_rate_pct}% taux (${score.stats.total_items_received}/${score.stats.total_items_ordered} unités)
⏱️ Ponctualité: ${score.stats.on_time_rate_pct}% (${score.stats.on_time_deliveries}/${score.stats.total_deliveries} à temps)${hasDelays ? ' ⚠️ RETARDS RÉCURRENTS' : ''}
⚖️ Litiges: ${score.stats.dispute_rate_pct}% (${score.stats.disputed_invoices}/${score.stats.total_invoices} factures)${hasDisputes ? ' 🚨 TAUX ÉLEVÉ' : ''}
💰 Paiements: ${score.stats.payment_rate_pct}% payé | ${score.stats.total_paid.toFixed(3)}/${score.stats.total_invoiced.toFixed(3)} TND | délai moy: ${score.stats.avg_payment_days}j${paymentHealthy ? ' ✅' : ''}

═══ INSTRUCTIONS D'ANALYSE ═══
Produis une analyse PRÉCISE basée sur les chiffres réels. Pas de généralités.
Chaque recommandation doit être CONCRÈTE et IMMÉDIATEMENT ACTIONNABLE.
Les benchmarks doivent être réalistes pour le marché tunisien.

RÉPONDS EN JSON COMPACT (sans espaces, sans markdown):
{"risk_prediction":{"risk_level":"low|medium|high|critical","risk_score":0,"risk_factors":["facteur précis avec chiffre"],"predicted_issues":["problème spécifique"],"confidence":0},"recommendations":[{"priority":"low|medium|high|urgent","action_type":"negotiate|diversify|reward|monitor|terminate|optimize","title":"Action concrète","description":"Description avec chiffres et délais précis","expected_impact":"Impact quantifié","estimated_savings":null}],"patterns":[{"pattern_type":"trend|anomaly|seasonality|correlation","title":"Titre précis","description":"Description factuelle","severity":"info|warning|critical","data_points":["donnée chiffrée"]}],"benchmarks":[{"metric":"Métrique","supplier_value":0,"industry_average":0,"top_quartile":0,"performance":"excellent|good|average|below_average|poor","gap_analysis":"Écart quantifié et contextualisé"}],"ai_summary":"Résumé professionnel 2 phrases avec chiffres clés","executive_summary":"1 phrase percutante sur le verdict global","key_strength":"Point fort principal en 10 mots max","key_weakness":"Point faible principal en 10 mots max","analysis_confidence":0}`;

    const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.2,   // Plus déterministe pour des insights précis
          maxOutputTokens: 8192,
          topP:            0.8,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    const data: GeminiResponse = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) throw new Error('Réponse IA vide');

    this.logger.debug(`Réponse IA: ${aiText.length} chars`);

    const analysis = parseGeminiJson(aiText);

    return {
      supplier_id:        score.supplier_id,
      supplier_name:      score.supplier_name,
      analysis_date:      new Date(),
      risk_prediction:    analysis.risk_prediction    ?? this.buildDefaultRisk(score),
      recommendations:    analysis.recommendations    ?? [],
      patterns:           analysis.patterns           ?? [],
      benchmarks:         analysis.benchmarks         ?? [],
      ai_summary:         analysis.ai_summary         ?? 'Analyse non disponible',
      executive_summary:  analysis.executive_summary  ?? '',
      key_strength:       analysis.key_strength       ?? '',
      key_weakness:       analysis.key_weakness       ?? '',
      analysis_confidence: analysis.analysis_confidence ?? 50,
    };
  }

  // ─── Fallback basique ─────────────────────────────────────────────────────
  private generateBasicInsights(score: SupplierScore): SupplierAIInsights {
    const riskScore = 100 - score.total_score;
    const riskLevel = riskScore >= 60 ? 'critical'
      : riskScore >= 40 ? 'high'
      : riskScore >= 20 ? 'medium'
      : 'low';

    const bestCriteria  = [...score.criteria].sort((a, b) => b.score - a.score)[0];
    const worstCriteria = [...score.criteria].sort((a, b) => a.score - b.score)[0];

    return {
      supplier_id:       score.supplier_id,
      supplier_name:     score.supplier_name,
      analysis_date:     new Date(),
      executive_summary: `${score.supplier_name} obtient ${score.total_score}/100 — grade ${score.grade}.`,
      key_strength:      bestCriteria  ? `${bestCriteria.name} (${bestCriteria.score}/100)` : '',
      key_weakness:      worstCriteria ? `${worstCriteria.name} (${worstCriteria.score}/100)` : '',
      risk_prediction: {
        risk_level:       riskLevel,
        risk_score:       riskScore,
        risk_factors:     this.identifyRiskFactors(score),
        predicted_issues: ['Configurez la clé IA pour des prédictions avancées'],
        confidence:       50,
      },
      recommendations: this.generateBasicRecommendations(score),
      patterns: [{
        pattern_type: 'trend',
        title:        'Analyse basique disponible',
        description:  'Activez l\'analyse IA pour des patterns avancés',
        severity:     'info',
        data_points:  [`Score: ${score.total_score}/100`, `Grade: ${score.grade}`],
      }],
      benchmarks:          this.generateBasicBenchmarks(score),
      ai_summary:          `Score global: ${score.total_score}/100 (${score.grade}). Activez l'analyse IA pour des insights complets.`,
      analysis_confidence: 50,
    };
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────
  private buildDefaultRisk(score: SupplierScore): RiskPrediction {
    const riskScore = 100 - score.total_score;
    return {
      risk_level:       riskScore >= 60 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low',
      risk_score:       riskScore,
      risk_factors:     this.identifyRiskFactors(score),
      predicted_issues: [],
      confidence:       60,
    };
  }

  private identifyRiskFactors(score: SupplierScore): string[] {
    const factors: string[] = [];
    score.criteria
      .filter(c => c.score < 50)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .forEach(c => factors.push(`${c.name} insuffisant (${c.score}/100 — poids ${c.weight}%)`));

    if (score.stats.dispute_rate_pct > 5)
      factors.push(`Litiges élevés : ${score.stats.dispute_rate_pct}% des factures`);
    if (score.stats.on_time_rate_pct < 80)
      factors.push(`Retards récurrents : seulement ${score.stats.on_time_rate_pct}% à temps`);
    if (score.stats.delivery_rate_pct < 90)
      factors.push(`Livraison incomplète : ${score.stats.delivery_rate_pct}% des quantités`);

    return factors.length > 0 ? factors : ['Aucun facteur de risque majeur identifié'];
  }

  private generateBasicRecommendations(score: SupplierScore): ActionRecommendation[] {
    const recs: ActionRecommendation[] = [];

    if (score.total_score >= 85) {
      recs.push({
        priority:         'medium',
        action_type:      'reward',
        title:            'Consolider le partenariat stratégique',
        description:      'Excellent fournisseur — envisagez un contrat pluriannuel avec tarifs préférentiels',
        expected_impact:  'Fidélisation et sécurisation de la chaîne d\'approvisionnement',
      });
    } else if (score.total_score >= 70) {
      recs.push({
        priority:        'low',
        action_type:     'optimize',
        title:           'Optimiser les points de friction',
        description:     'Bon fournisseur avec des marges d\'amélioration identifiées',
        expected_impact: 'Amélioration du score de 5 à 10 points',
      });
    } else if (score.total_score >= 55) {
      recs.push({
        priority:        'high',
        action_type:     'negotiate',
        title:           'Renégocier les conditions contractuelles',
        description:     'Performance moyenne — fixez des objectifs mesurables avec pénalités',
        expected_impact: 'Amélioration des KPIs sous 90 jours',
      });
    } else {
      recs.push({
        priority:        'urgent',
        action_type:     'monitor',
        title:           'Surveillance renforcée immédiate',
        description:     'Performance insuffisante — évaluez des fournisseurs alternatifs en parallèle',
        expected_impact: 'Réduction du risque d\'approvisionnement',
      });
    }
    return recs;
  }

  private generateBasicBenchmarks(score: SupplierScore): BenchmarkComparison[] {
    return [
      {
        metric:           'Score global',
        supplier_value:   score.total_score,
        industry_average: 68,
        top_quartile:     85,
        performance:      score.total_score >= 85 ? 'excellent' : score.total_score >= 68 ? 'good' : score.total_score >= 55 ? 'average' : 'poor',
        gap_analysis:     score.total_score >= 85
          ? 'Dans le top quartile du marché'
          : `Écart de ${85 - score.total_score} points avec le top quartile`,
      },
      {
        metric:           'Taux de livraison',
        supplier_value:   score.stats.delivery_rate_pct,
        industry_average: 92,
        top_quartile:     98,
        performance:      score.stats.delivery_rate_pct >= 98 ? 'excellent' : score.stats.delivery_rate_pct >= 92 ? 'good' : 'below_average',
        gap_analysis:     `Marché tunisien: moy 92%, top 98%`,
      },
      {
        metric:           'Ponctualité livraison',
        supplier_value:   score.stats.on_time_rate_pct,
        industry_average: 80,
        top_quartile:     95,
        performance:      score.stats.on_time_rate_pct >= 95 ? 'excellent' : score.stats.on_time_rate_pct >= 80 ? 'good' : 'poor',
        gap_analysis:     score.stats.on_time_rate_pct >= 80
          ? 'Dans la norme du marché'
          : `${80 - score.stats.on_time_rate_pct}% en-dessous de la moyenne`,
      },
    ];
  }
}