# 📊 Guide Visuel - Gestion des Litiges de Factures

## 🎯 Comprendre en 5 Minutes

---

## 1️⃣ Qu'est-ce qu'un Litige?

Un **litige** survient quand la facture fournisseur ne correspond pas au bon de commande ou au bon de réception.

### Exemple Simple

```
Vous avez commandé:     100 stylos × 2 TND = 200 TND
Vous avez reçu:         100 stylos
Le fournisseur facture: 100 stylos × 3 TND = 300 TND  ❌ PROBLÈME!
```

**Écart**: 100 TND (50%) → **LITIGE AUTOMATIQUE**

---

## 2️⃣ Les 8 Types de Litiges

### 🔴 CRITIQUE (Action Immédiate)

#### 1. PRICE_DISCREPANCY (Écart de Prix)
```
BC:      10 TND/unité
Facture: 15 TND/unité
Écart:   +50% ❌
Action:  Contacter fournisseur immédiatement
```

#### 2. OVER_INVOICED (Surfacturation)
```
Reçu:    80 unités
Facturé: 100 unités
Écart:   +25% ❌
Action:  Demander avoir ou facture rectificative
```

#### 3. UNAUTHORIZED_CHARGE (Frais Non Autorisés)
```
BC:      1000 TND
Facture: 1000 TND + 200 TND frais transport ❌
Action:  Refuser les frais supplémentaires
```

---

### 🟡 MOYEN (Vérification Requise)

#### 4. PARTIAL_DELIVERY (Livraison Partielle)
```
Commandé: 100 unités
Reçu:     60 unités
Facturé:  60 unités ✅
Action:   Approuver si montant correct
```

#### 5. QUANTITY_MISMATCH (Écart de Quantité)
```
Commandé: 100 unités
Reçu:     95 unités
Facturé:  100 unités ❌
Action:   Vérifier avec logistique
```

#### 6. CALCULATION_ERROR (Erreur de Calcul)
```
Sous-total: 1000 TND
TVA 19%:    190 TND
Timbre:     1 TND
Total:      1200 TND (au lieu de 1191 TND) ❌
Action:     Demander correction
```

---

### 🟢 FAIBLE (Résolution Rapide)

#### 7. MISSING_DELIVERY (Livraison Manquante)
```
Facture reçue: 15/01/2024
Livraison:     Aucune ❌
Action:        Attendre la livraison
```

#### 8. DUPLICATE_INVOICE (Facture en Double)
```
Facture #INV-001 déjà enregistrée ❌
Action:        Rejeter le doublon
```

---

## 3️⃣ Comment l'IA Analyse?

### Étape 1: Collecte des Données
```
┌─────────────────┐
│ Bon de Commande │ → 5000 TND
└─────────────────┘

┌─────────────────┐
│ Bon de Réception│ → 4800 TND (livraison partielle)
└─────────────────┘

┌─────────────────┐
│    Facture      │ → 4800 TND
└─────────────────┘
```

### Étape 2: Calcul des Écarts
```
Écart BC vs Facture:  -200 TND (-4%)
Écart BR vs Facture:  0 TND (0%) ✅
```

### Étape 3: Analyse IA
```
🤖 Claude AI analyse:
   • Livraison partielle détectée
   • Facture correspond à la réception
   • Pas de surfacturation
   • Situation normale
```

### Étape 4: Décision
```
✅ Score de confiance: 95%
✅ Risque: FAIBLE
✅ Action: AUTO-APPROBATION
✅ Catégorie: PARTIAL_DELIVERY
```

---

## 4️⃣ Score de Confiance Expliqué

### 🟢 90-100% : Très Confiant
```
┌────────────────────────────────────┐
│ ████████████████████████████████ │ 95%
└────────────────────────────────────┘

Signification: Tout est clair, approbation automatique
Action:        Approuver sans hésitation
```

### 🔵 70-89% : Confiant
```
┌────────────────────────────────────┐
│ ████████████████████████░░░░░░░░ │ 75%
└────────────────────────────────────┘

Signification: Écarts mineurs acceptables
Action:        Approuver ou vérifier rapidement
```

### 🟡 50-69% : Incertain
```
┌────────────────────────────────────┐
│ ████████████████░░░░░░░░░░░░░░░░ │ 60%
└────────────────────────────────────┘

Signification: Nécessite vérification manuelle
Action:        Analyser avant de décider
```

### 🟠 25-49% : Peu Confiant
```
┌────────────────────────────────────┐
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░ │ 35%
└────────────────────────────────────┘

Signification: Problème probable détecté
Action:        Mettre en litige automatiquement
```

### 🔴 0-24% : Très Peu Confiant
```
┌────────────────────────────────────┐
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ 15%
└────────────────────────────────────┘

Signification: Problème majeur confirmé
Action:        Litige + Alerte urgente
```

---

## 5️⃣ Niveau de Risque Expliqué

### 🟢 LOW (Faible)
```
✅ Écart < 0.5%
✅ Tout correspond
✅ Approbation automatique
⏱️ Résolution: Immédiate
```

### 🟡 MEDIUM (Moyen)
```
⚠️ Écart 0.5-5%
⚠️ Vérification recommandée
⚠️ Décision manuelle
⏱️ Résolution: 1-2 jours
```

### 🟠 HIGH (Élevé)
```
❌ Écart 5-10%
❌ Investigation requise
❌ Litige probable
⏱️ Résolution: 3-5 jours
```

### 🔴 CRITICAL (Critique)
```
🚨 Écart > 10%
🚨 Problème majeur
🚨 Action urgente
⏱️ Résolution: 5-7 jours
```

---

## 6️⃣ Actions Suggérées - Exemples

### Exemple 1: Livraison Partielle ✅

**Situation**:
- Commandé: 100 unités
- Reçu: 60 unités
- Facturé: 60 unités

**Analyse IA**:
```
✅ Score: 95%
✅ Risque: LOW
✅ Action: AUTO-APPROVE
```

**Actions Suggérées**:
1. ✅ Approuver cette facture
2. 📦 Suivre la livraison du solde (40 unités)
3. 📧 Confirmer la date de livraison avec le fournisseur

---

### Exemple 2: Surfacturation ❌

**Situation**:
- Commandé: 50 unités × 100 TND = 5000 TND
- Reçu: 50 unités
- Facturé: 50 unités × 120 TND = 6000 TND

**Analyse IA**:
```
❌ Score: 15%
🔴 Risque: CRITICAL
❌ Action: AUTO-DISPUTE
```

**Actions Suggérées**:
1. 🚨 Contacter IMMÉDIATEMENT le fournisseur
2. 📄 Demander facture rectificative (avoir de 1000 TND)
3. 🚫 BLOQUER le paiement jusqu'à résolution
4. 📝 Documenter tous les échanges pour audit

---

### Exemple 3: Erreur de Calcul ⚠️

**Situation**:
- Sous-total HT: 1000 TND
- TVA 19%: 190 TND
- Timbre: 1 TND
- Total facturé: 1200 TND (au lieu de 1191 TND)

**Analyse IA**:
```
⚠️ Score: 60%
🟡 Risque: MEDIUM
⚠️ Action: MANUAL_REVIEW
```

**Actions Suggérées**:
1. 🔍 Vérifier les calculs manuellement
2. 📧 Contacter le fournisseur si erreur confirmée
3. ✅ Corriger dans le système si erreur de saisie
4. 📄 Ou demander facture rectificative

---

## 7️⃣ Délais de Résolution

```
┌─────────────────────────────────────────────────────────┐
│ Type de Litige              │ Délai Moyen │ Priorité   │
├─────────────────────────────────────────────────────────┤
│ DUPLICATE_INVOICE           │ Immédiat    │ 🟢 Faible  │
│ CALCULATION_ERROR           │ 1-2 jours   │ 🟢 Faible  │
│ PARTIAL_DELIVERY            │ 2-3 jours   │ 🟡 Moyenne │
│ PRICE_DISCREPANCY           │ 3-5 jours   │ 🟠 Élevée  │
│ MISSING_DELIVERY            │ 3-5 jours   │ 🟠 Élevée  │
│ QUANTITY_MISMATCH           │ 5-7 jours   │ 🔴 Critique│
│ UNAUTHORIZED_CHARGE         │ 5-7 jours   │ 🔴 Critique│
│ QUALITY_ISSUE               │ 7-14 jours  │ 🔴 Critique│
└─────────────────────────────────────────────────────────┘
```

---

## 8️⃣ Interface Utilisateur

### Vue d'ensemble
```
┌─────────────────────────────────────────────────────────┐
│  🤖 Analyse IA du Rapprochement          Score: 95% ✅  │
├─────────────────────────────────────────────────────────┤
│  ████████████████████████████████████████████████░░░░  │
├─────────────────────────────────────────────────────────┤
│  🟢 Risque: FAIBLE    │  ✅ Action: AUTO-APPROVE       │
├─────────────────────────────────────────────────────────┤
│  📋 Catégorie: PARTIAL_DELIVERY                         │
├─────────────────────────────────────────────────────────┤
│  📝 Explication:                                        │
│  Livraison partielle : la facture correspond            │
│  exactement à ce qui a été reçu. Approbation possible.  │
├─────────────────────────────────────────────────────────┤
│  🔍 Points Clés:                                        │
│  • Facture conforme à la réception                      │
│  • Livraison partielle normale                          │
│  • Reste à recevoir : 2000 TND                          │
├─────────────────────────────────────────────────────────┤
│  ✅ Actions Suggérées:                                  │
│  1. Approuver cette facture                             │
│  2. Suivre la livraison du solde de la commande         │
├─────────────────────────────────────────────────────────┤
│  ⏱️ Délai de Résolution: 1 jour ouvré                   │
├─────────────────────────────────────────────────────────┤
│  [✅ Approuver]  [📧 Contacter Fournisseur]             │
└─────────────────────────────────────────────────────────┘
```

---

## 9️⃣ Workflow Complet

```
📥 FACTURE REÇUE
    ↓
🔍 RAPPROCHEMENT AUTOMATIQUE
    ↓
    ├─ Comparaison BC ↔ BR ↔ Facture
    ├─ Calcul des écarts
    └─ Détection des anomalies
    ↓
🤖 ANALYSE IA (2-5 secondes)
    ↓
    ├─ Score de confiance (0-100%)
    ├─ Niveau de risque (LOW/MEDIUM/HIGH/CRITICAL)
    ├─ Catégorisation du litige
    ├─ Explication en français
    └─ Actions suggérées
    ↓
    ┌─────────┴─────────┐
    ↓                   ↓
✅ APPROBATION      ❌ LITIGE
    ↓                   ↓
💰 PAIEMENT         📧 NOTIFICATION
                        ↓
                    🔧 RÉSOLUTION
                        ↓
                    ✅ APPROBATION
                        ↓
                    💰 PAIEMENT
```

---

## 🎯 Résumé en 3 Points

### 1. L'IA Analyse Automatiquement
- Compare BC, BR et Facture
- Détecte les écarts
- Explique clairement les problèmes

### 2. Vous Décidez en Connaissance de Cause
- Score de confiance visible
- Niveau de risque indiqué
- Actions concrètes suggérées

### 3. Gain de Temps Massif
- 90% de temps gagné
- Moins d'erreurs
- Résolution plus rapide

---

## 📞 Besoin d'Aide?

**Support**: support@pi-dev.tn  
**Documentation**: https://docs.pi-dev.tn  
**Hotline**: +216 XX XXX XXX

---

**Version**: 1.0.0  
**Date**: Janvier 2024  
**Licence**: Propriétaire
