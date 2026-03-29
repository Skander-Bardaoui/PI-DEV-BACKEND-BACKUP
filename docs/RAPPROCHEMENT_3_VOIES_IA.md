# 🤖 Rapprochement 3 Voies avec Intelligence Artificielle

## Vue d'ensemble

Le système de rapprochement 3 voies a été amélioré avec l'intégration de l'intelligence artificielle (Claude AI) pour automatiser et améliorer la détection des écarts entre les factures fournisseurs, les bons de commande et les bons de réception.

---

## 🎯 Objectifs

1. **Automatisation intelligente**: Réduire le temps de traitement des factures de 70%
2. **Précision accrue**: Détecter 95%+ des anomalies automatiquement
3. **Clarté des litiges**: Explications claires et actionnables pour chaque écart
4. **Réduction des erreurs**: Minimiser les paiements incorrects

---

## 🔄 Processus Amélioré

### Avant (Sans IA)

```
Facture → Comparaison simple → Écart détecté → Litige générique
```

**Problèmes**:
- Raisons de litige peu claires
- Pas de priorisation des écarts
- Actions à prendre non définies
- Délais de résolution longs

### Après (Avec IA)

```
Facture → Comparaison → Analyse IA → Recommandation claire → Action automatique
```

**Avantages**:
- Explication détaillée de chaque écart
- Score de confiance pour chaque décision
- Catégorisation automatique des litiges
- Actions suggérées étape par étape
- Estimation du délai de résolution

---

## 🧠 Fonctionnement de l'IA

### 1. Collecte des Données

L'IA reçoit:
- Montants du Bon de Commande (BC)
- Montants du Bon de Réception (BR)
- Montants de la Facture
- Détail ligne par ligne
- Historique du fournisseur (futur)

### 2. Analyse Multi-Critères

L'IA évalue:
- **Écarts de prix**: Prix unitaires différents
- **Écarts de quantité**: Quantités facturées vs reçues
- **Écarts de calcul**: TVA, timbre fiscal, totaux
- **Cohérence temporelle**: Dates de livraison vs facturation
- **Patterns suspects**: Surfacturation récurrente

### 3. Scoring de Confiance

| Score | Signification | Action |
|-------|---------------|--------|
| 90-100% | Correspondance parfaite | Auto-approbation |
| 75-89% | Écarts minimes acceptables | Auto-approbation |
| 50-74% | Écarts nécessitant vérification | Revue manuelle |
| 25-49% | Écarts significatifs | Auto-litige |
| 0-24% | Problème majeur | Auto-litige + Alerte |

### 4. Catégorisation des Litiges

L'IA identifie automatiquement:

1. **PRICE_DISCREPANCY**: Écart de prix unitaire
2. **QUANTITY_MISMATCH**: Écart de quantité
3. **MISSING_DELIVERY**: Livraison non reçue
4. **PARTIAL_DELIVERY**: Livraison partielle
5. **CALCULATION_ERROR**: Erreur de calcul
6. **UNAUTHORIZED_CHARGE**: Frais non autorisés
7. **DUPLICATE_INVOICE**: Facture en double
8. **QUALITY_ISSUE**: Problème de qualité

### 5. Recommandations Actionnables

Pour chaque litige, l'IA fournit:
- **Explication claire** en français
- **Points clés** identifiés
- **Actions suggérées** étape par étape
- **Délai de résolution** estimé
- **Niveau de risque** (LOW, MEDIUM, HIGH, CRITICAL)

---

## 📊 Exemple d'Analyse IA

### Cas: Surfacturation Détectée

**Données d'entrée**:
```json
{
  "po_total": 5000.00,
  "received_total": 5000.00,
  "invoiced_total": 6000.00,
  "discrepancy_pct": 20.0
}
```

**Analyse IA**:
```json
{
  "confidence_score": 15,
  "risk_level": "CRITICAL",
  "recommended_action": "AUTO_DISPUTE",
  "dispute_category": "PRICE_DISCREPANCY",
  "explanation": "Prix unitaire facturé (120 TND) supérieur au prix du BC (100 TND). Écart de 20% non justifié.",
  "key_findings": [
    "Surfacturation de 1000 TND détectée",
    "Écart systématique sur toutes les lignes",
    "Aucune modification de prix autorisée dans le BC"
  ],
  "suggested_next_steps": [
    "Contacter immédiatement le fournisseur",
    "Demander une facture rectificative (avoir)",
    "Bloquer le paiement jusqu'à résolution",
    "Documenter l'échange pour audit"
  ],
  "estimated_resolution_time": "5-7 jours ouvrés"
}
```

**Résultat**: Facture mise en litige automatiquement avec raison claire

---

## 🛠️ Utilisation

### Backend (API)

#### 1. Rapprochement avec IA (par défaut)

```bash
GET /businesses/:businessId/three-way-matching/invoice/:invoiceId
```

Réponse:
```json
{
  "invoice_id": "uuid",
  "status": "MISMATCH",
  "can_auto_approve": false,
  "should_auto_dispute": true,
  "discrepancy_pct": 20.0,
  "ai_analysis": {
    "confidence_score": 15,
    "risk_level": "CRITICAL",
    "recommended_action": "AUTO_DISPUTE",
    ...
  }
}
```

#### 2. Rapprochement sans IA

```bash
GET /businesses/:businessId/three-way-matching/invoice/:invoiceId?useAI=false
```

#### 3. Appliquer l'action automatique

```bash
POST /businesses/:businessId/three-way-matching/invoice/:invoiceId/apply
```

Applique automatiquement:
- Approbation si `can_auto_approve = true`
- Litige si `should_auto_dispute = true`

### Frontend (React)

#### 1. Hook avec IA

```typescript
import { useInvoiceMatch } from '@/hooks/useThreeWayMatching';

const { data: matchResult, isLoading } = useInvoiceMatch(
  businessId,
  invoiceId,
  true // useAI = true
);

if (matchResult?.ai_analysis) {
  console.log('Score:', matchResult.ai_analysis.confidence_score);
  console.log('Risque:', matchResult.ai_analysis.risk_level);
}
```

#### 2. Composant d'affichage

```typescript
import ThreeWayMatchingAIPanel from '@/components/purchases/ThreeWayMatchingAIPanel';

<ThreeWayMatchingAIPanel
  analysis={matchResult.ai_analysis}
  onApprove={handleApprove}
  onDispute={handleDispute}
  onContactSupplier={handleContact}
/>
```

---

## ⚙️ Configuration

### Variables d'Environnement

```env
# Clé API Gemini (obligatoire pour l'IA)
GEMINI_API_KEY=AIzaSyBLqH6IfuLEuoQAUxgkVrceWRVswLY6OoM

# Seuils de tolérance
MATCHING_TOLERANCE_PCT=0.5
AUTO_DISPUTE_THRESHOLD_PCT=5.0

# Activation/désactivation
ENABLE_AI_MATCHING=true
```

### Fallback sans IA

Si `GEMINI_API_KEY` n'est pas configurée, le système utilise automatiquement des règles métier standards:

- Écart < 0.5% → Auto-approbation
- Écart 0.5-5% → Revue manuelle
- Écart > 5% → Auto-litige

---

## 📈 Métriques et KPIs

### Métriques Suivies

1. **Taux d'utilisation IA**: % de rapprochements utilisant l'IA
2. **Précision IA**: % de décisions IA validées par les comptables
3. **Temps de traitement**: Temps moyen de résolution des litiges
4. **Taux d'auto-approbation**: % de factures approuvées automatiquement
5. **Taux de faux positifs**: % de litiges créés à tort

### Objectifs

| Métrique | Objectif | Actuel |
|----------|----------|--------|
| Précision IA | > 90% | À mesurer |
| Temps de traitement | < 2 jours | À mesurer |
| Auto-approbation | > 70% | À mesurer |
| Faux positifs | < 5% | À mesurer |

---

## 🔒 Sécurité et Conformité

### Protection des Données

- Les données envoyées à l'IA sont anonymisées
- Pas de stockage des données par Anthropic (selon leur politique)
- Logs d'audit pour toutes les décisions IA

### Validation Humaine

- Les décisions IA sont toujours révisables
- Un comptable peut forcer l'approbation/litige
- Historique complet des décisions conservé

### Conformité Comptable Tunisienne

- Respect des normes comptables tunisiennes
- Timbre fiscal de 1,000 TND pris en compte
- TVA à 19% (ou autre taux) correctement calculée

---

## 🚀 Évolutions Futures

### Phase 2 (Q2 2024)

- [ ] Apprentissage des patterns par fournisseur
- [ ] Détection des fraudes récurrentes
- [ ] Suggestions de négociation de prix
- [ ] Prédiction des délais de livraison

### Phase 3 (Q3 2024)

- [ ] Analyse des tendances de marché
- [ ] Comparaison avec les prix du marché
- [ ] Recommandations de fournisseurs alternatifs
- [ ] Optimisation automatique des commandes

---

## 🐛 Dépannage

### L'IA ne fonctionne pas

1. Vérifier `ANTHROPIC_API_KEY` dans `.env`
2. Vérifier les logs: `grep "Analyse IA" logs/app.log`
3. Tester l'API Anthropic directement
4. Vérifier le quota API

### Décisions IA incorrectes

1. Documenter le cas dans un ticket
2. Forcer la décision correcte manuellement
3. L'équipe analysera pour améliorer le prompt

### Performance lente

1. L'analyse IA prend 2-5 secondes (normal)
2. Utiliser `useAI=false` pour les tests rapides
3. Mettre en cache les résultats (déjà implémenté)

---

## 📞 Support

- **Email**: support@pi-dev.tn
- **Documentation**: https://docs.pi-dev.tn/rapprochement-ia
- **Slack**: #support-achats

---

## 📝 Changelog

### v1.0.0 (2024-01-XX)

- ✅ Intégration Claude AI pour l'analyse
- ✅ Scoring de confiance 0-100%
- ✅ Catégorisation automatique des litiges
- ✅ Recommandations actionnables
- ✅ Estimation des délais de résolution
- ✅ Composant React d'affichage
- ✅ Documentation complète

---

## 🙏 Remerciements

Merci à Google pour leur API Gemini qui rend cette fonctionnalité possible.
