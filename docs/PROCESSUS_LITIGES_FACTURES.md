# 📋 Processus de Gestion des Factures en Litige

## Vue d'ensemble

Le système de gestion des litiges permet de détecter, documenter et résoudre automatiquement les écarts entre les factures fournisseurs et les commandes/réceptions.

---

## 🔄 Flux du Processus

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FACTURE FOURNISSEUR REÇUE                        │
│                         (Status: PENDING)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              RAPPROCHEMENT 3 VOIES (avec IA)                        │
│                                                                      │
│  1. Vérification Bon de Commande (BC)                              │
│  2. Vérification Bon de Réception (BR)                             │
│  3. Comparaison des montants                                        │
│  4. Analyse IA des écarts                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │  TOUT CORRESPOND  │     │   ÉCART DÉTECTÉ   │
    │   (Écart < 0.5%)  │     │   (Écart > 0.5%)  │
    └─────────┬─────────┘     └─────────┬─────────┘
              │                         │
              ▼                         ▼
    ┌───────────────────┐     ┌───────────────────────────────┐
    │  AUTO-APPROBATION │     │    ANALYSE IA APPROFONDIE     │
    │                   │     │                               │
    │ Status: APPROVED  │     │ • Score de confiance (0-100)  │
    └───────────────────┘     │ • Niveau de risque            │
                              │ • Catégorie de litige         │
                              │ • Recommandations             │
                              └──────────┬────────────────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                        ▼                ▼                ▼
              ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
              │ RISQUE BAS  │  │RISQUE MOYEN │  │RISQUE ÉLEVÉ │
              │             │  │             │  │             │
              │ Confiance   │  │ Confiance   │  │ Confiance   │
              │   > 85%     │  │  50-85%     │  │   < 50%     │
              └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                     │                │                │
                     ▼                ▼                ▼
           ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
           │AUTO-APPROVE │  │REVUE MANUELLE│  │ AUTO-LITIGE  │
           │             │  │              │  │              │
           │   APPROVED  │  │   PENDING    │  │   DISPUTED   │
           └─────────────┘  └──────────────┘  └──────┬───────┘
                                                      │
                                                      ▼
                                          ┌───────────────────────┐
                                          │  NOTIFICATION ENVOYÉE │
                                          │                       │
                                          │ • Comptable           │
                                          │ • Responsable achats  │
                                          │ • Fournisseur (opt.)  │
                                          └───────────┬───────────┘
                                                      │
                                                      ▼
                                          ┌───────────────────────┐
                                          │  RÉSOLUTION MANUELLE  │
                                          │                       │
                                          │ Actions possibles:    │
                                          │ • Corriger montants   │
                                          │ • Contacter fourniss. │
                                          │ • Demander avoir      │
                                          │ • Approuver malgré    │
                                          └───────────┬───────────┘
                                                      │
                                                      ▼
                                          ┌───────────────────────┐
                                          │  LITIGE RÉSOLU        │
                                          │                       │
                                          │  Status: APPROVED     │
                                          └───────────────────────┘
```

---

## 📊 Catégories de Litiges

### 1. **PRICE_DISCREPANCY** (Écart de prix)
- **Description**: Le prix unitaire facturé diffère du prix du BC
- **Exemple**: BC = 10,000 TND/unité, Facture = 12,000 TND/unité
- **Action**: Vérifier avec le fournisseur, demander justification
- **Délai résolution**: 3-5 jours ouvrés

### 2. **QUANTITY_MISMATCH** (Écart de quantité)
- **Description**: La quantité facturée ne correspond pas à la réception
- **Exemple**: Reçu 80 unités, facturé 100 unités
- **Action**: Demander avoir ou facture rectificative
- **Délai résolution**: 5-7 jours ouvrés

### 3. **MISSING_DELIVERY** (Livraison manquante)
- **Description**: Facture reçue mais aucun bon de réception
- **Exemple**: Facture datée du 15/01, aucune livraison enregistrée
- **Action**: Vérifier avec logistique, bloquer paiement
- **Délai résolution**: 3-5 jours ouvrés

### 4. **PARTIAL_DELIVERY** (Livraison partielle)
- **Description**: Livraison partielle mais facture pour le total
- **Exemple**: Commandé 100, reçu 60, facturé 100
- **Action**: Demander facture partielle ou attendre livraison complète
- **Délai résolution**: 2-3 jours ouvrés

### 5. **CALCULATION_ERROR** (Erreur de calcul)
- **Description**: Erreur dans le calcul TVA, timbre ou total
- **Exemple**: Sous-total correct mais total TTC erroné
- **Action**: Demander facture rectificative
- **Délai résolution**: 1-2 jours ouvrés

### 6. **UNAUTHORIZED_CHARGE** (Frais non autorisés)
- **Description**: Frais supplémentaires non prévus au BC
- **Exemple**: Frais de transport non convenus
- **Action**: Refuser les frais ou négocier
- **Délai résolution**: 5-7 jours ouvrés

### 7. **DUPLICATE_INVOICE** (Facture en double)
- **Description**: Même facture reçue plusieurs fois
- **Exemple**: Facture #INV-2024-001 déjà enregistrée
- **Action**: Rejeter le doublon
- **Délai résolution**: Immédiat

### 8. **QUALITY_ISSUE** (Problème de qualité)
- **Description**: Marchandises non conformes
- **Exemple**: Produits défectueux ou endommagés
- **Action**: Retour marchandises, demander avoir
- **Délai résolution**: 7-14 jours ouvrés

---

## 🤖 Analyse IA - Scoring de Confiance

### Score de Confiance (0-100%)

| Score | Niveau | Action Recommandée | Description |
|-------|--------|-------------------|-------------|
| 90-100% | Très élevé | AUTO-APPROVE | Correspondance parfaite, aucun risque |
| 75-89% | Élevé | AUTO-APPROVE | Écarts minimes dans la tolérance |
| 50-74% | Moyen | MANUAL_REVIEW | Écarts nécessitant vérification |
| 25-49% | Faible | AUTO-DISPUTE | Écarts significatifs détectés |
| 0-24% | Très faible | AUTO-DISPUTE + ALERT | Problème majeur, action urgente |

### Niveau de Risque

- **LOW** (Faible): Écart < 0.5%, correspondance quasi-parfaite
- **MEDIUM** (Moyen): Écart 0.5-5%, vérification recommandée
- **HIGH** (Élevé): Écart 5-10%, investigation requise
- **CRITICAL** (Critique): Écart > 10% ou problème structurel

---

## 🛠️ Actions Disponibles

### Pour le Comptable

1. **Approuver malgré l'écart**
   ```
   POST /businesses/:bId/purchase-invoices/:invoiceId/approve
   ```
   - Utiliser si l'écart est justifié
   - Ajouter un commentaire explicatif

2. **Corriger les montants**
   ```
   PATCH /businesses/:bId/purchase-invoices/:invoiceId
   Body: { subtotal_ht, tax_amount, ... }
   ```
   - Corriger les erreurs de saisie
   - Recalcul automatique du total

3. **Résoudre le litige**
   ```
   POST /businesses/:bId/purchase-invoices/:invoiceId/resolve-dispute
   ```
   - Après accord avec le fournisseur
   - Passe le statut à APPROVED

4. **Contacter le fournisseur**
   - Email automatique avec détails du litige
   - Pièces jointes: BC, BR, analyse IA

### Pour le Fournisseur

1. **Consulter le litige**
   ```
   GET /supplier-portal?token=xxx
   ```
   - Voir les détails de l'écart
   - Télécharger les documents

2. **Soumettre une justification**
   - Upload de documents justificatifs
   - Commentaires explicatifs

---

## 📈 Indicateurs de Performance

### KPIs Suivis

1. **Taux de litiges**: `(Factures en litige / Total factures) × 100`
2. **Délai moyen de résolution**: Temps entre DISPUTED et APPROVED
3. **Taux d'auto-approbation**: `(Auto-approuvées / Total) × 100`
4. **Précision IA**: `(Décisions IA correctes / Total décisions) × 100`

### Objectifs

- Taux de litiges < 5%
- Délai résolution < 3 jours
- Taux auto-approbation > 80%
- Précision IA > 90%

---

## 🔧 Configuration

### Variables d'Environnement

```env
# Activation de l'IA (utilise la clé Gemini existante)
GEMINI_API_KEY=AIzaSyBLqH6IfuLEuoQAUxgkVrceWRVswLY6OoM

# Seuils de tolérance
MATCHING_TOLERANCE_PCT=0.5
AUTO_DISPUTE_THRESHOLD_PCT=5.0

# Notifications
ENABLE_DISPUTE_NOTIFICATIONS=true
DISPUTE_EMAIL_RECIPIENTS=comptable@entreprise.tn,achats@entreprise.tn
```

### Paramètres API

```typescript
// Désactiver l'IA pour un rapprochement spécifique
GET /businesses/:bId/three-way-matching/invoice/:invoiceId?useAI=false

// Forcer l'action automatique
POST /businesses/:bId/three-way-matching/invoice/:invoiceId/apply?useAI=true
```

---

## 📝 Exemples de Cas Réels

### Cas 1: Livraison Partielle Normale

**Situation**:
- BC: 100 unités × 50 TND = 5 000 TND
- BR: 60 unités reçues
- Facture: 60 unités × 50 TND = 3 000 TND

**Analyse IA**:
- Score: 95%
- Risque: LOW
- Action: AUTO-APPROVE
- Explication: "Livraison partielle : la facture correspond exactement à ce qui a été reçu"

**Résultat**: ✅ Approuvée automatiquement

---

### Cas 2: Surfacturation Détectée

**Situation**:
- BC: 50 unités × 100 TND = 5 000 TND
- BR: 50 unités reçues
- Facture: 50 unités × 120 TND = 6 000 TND

**Analyse IA**:
- Score: 15%
- Risque: CRITICAL
- Action: AUTO-DISPUTE
- Catégorie: PRICE_DISCREPANCY
- Explication: "Prix unitaire facturé (120 TND) supérieur au prix du BC (100 TND). Écart de 20%."

**Actions suggérées**:
1. Contacter immédiatement le fournisseur
2. Demander facture rectificative
3. Bloquer le paiement

**Résultat**: ⚠️ Mise en litige automatique

---

### Cas 3: Erreur de Calcul TVA

**Situation**:
- BC: 1 000 TND HT
- TVA 19%: 190 TND
- Timbre: 1 TND
- Total attendu: 1 191 TND
- Facture: 1 200 TND (erreur de calcul)

**Analyse IA**:
- Score: 60%
- Risque: MEDIUM
- Action: MANUAL_REVIEW
- Catégorie: CALCULATION_ERROR
- Explication: "Écart de 9 TND (0.75%) probablement dû à une erreur de calcul"

**Actions suggérées**:
1. Vérifier les calculs
2. Corriger dans le système si erreur de saisie
3. Ou demander facture rectificative au fournisseur

**Résultat**: 🔍 Revue manuelle requise

---

## 🚀 Bonnes Pratiques

### Pour Minimiser les Litiges

1. **Saisie précise des BC**
   - Vérifier les prix unitaires
   - Confirmer les conditions avec le fournisseur

2. **Enregistrement rapide des BR**
   - Créer le BR dès réception
   - Vérifier les quantités et qualité

3. **Vérification avant saisie facture**
   - Comparer visuellement avec le BC
   - Vérifier les calculs

4. **Communication proactive**
   - Informer le fournisseur des écarts rapidement
   - Documenter tous les échanges

### Pour Résoudre Rapidement

1. **Prioriser par risque**
   - Traiter d'abord les litiges CRITICAL
   - Déléguer les litiges LOW

2. **Utiliser les templates d'email**
   - Emails pré-rédigés pour chaque catégorie
   - Gain de temps et cohérence

3. **Suivre les délais**
   - Dashboard des litiges en cours
   - Alertes si délai dépassé

4. **Analyser les tendances**
   - Identifier les fournisseurs problématiques
   - Améliorer les processus

---

## 📞 Support

Pour toute question sur le processus de gestion des litiges:
- Email: support@pi-dev.tn
- Documentation: https://docs.pi-dev.tn/litiges
- Hotline: +216 XX XXX XXX
