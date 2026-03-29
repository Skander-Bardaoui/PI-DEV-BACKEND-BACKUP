# Schéma des Relations - Module Collaboration

## Vue d'ensemble

Ce document décrit toutes les relations entre les entités du module collaboration et les autres modules du système.

## Entités Collaboration

### 1. Task (Tâches)

**Relations:**
- `assignedTo` → User (ManyToOne) - Utilisateur assigné à la tâche
- `createdBy` → User (ManyToOne) - Utilisateur qui a créé la tâche
- `tenant` → Tenant (ManyToOne) - Tenant propriétaire
- `business` → Business (ManyToOne, optionnel) - Entreprise liée
- `client` → Client (ManyToOne, optionnel) - Client lié
- `comments` → Comment[] (OneToMany) - Commentaires sur la tâche
- `activityLogs` → ActivityLog[] (OneToMany) - Journal d'activité

**Champs polymorphes:**
- `relatedEntityType` + `relatedEntityId` - Lien vers n'importe quel document (Quote, SalesOrder, Invoice, etc.)

**Cas d'usage:**
- Tâche générale d'équipe
- Tâche liée à un devis (relatedEntityType = QUOTE)
- Tâche liée à une commande client
- Tâche liée à un client spécifique
- Tâche de suivi de paiement

---

### 2. Comment (Commentaires)

**Relations:**
- `user` → User (ManyToOne) - Auteur du commentaire
- `task` → Task (ManyToOne, optionnel) - Tâche commentée
- `quote` → Quote (ManyToOne, optionnel) - Devis commenté
- `salesOrder` → SalesOrder (ManyToOne, optionnel) - Commande commentée
- `supplierPO` → SupplierPO (ManyToOne, optionnel) - BC fournisseur commenté
- `purchaseInvoice` → PurchaseInvoice (ManyToOne, optionnel) - Facture achat commentée

**Champs polymorphes:**
- `entityType` + `entityId` - Identifie l'entité commentée

**Fonctionnalités:**
- Mentions d'utilisateurs (@user) via `mentionedUserIds`
- Pièces jointes via `attachments`
- Commentaires imbriqués via `parentCommentId`
- Soft delete via `isDeleted`

**Cas d'usage:**
- Discussion sur un devis avant envoi
- Notes internes sur une commande
- Questions sur une facture fournisseur
- Commentaires sur une tâche

---

### 3. Notification (Notifications)

**Relations:**
- `user` → User (ManyToOne) - Destinataire de la notification
- `tenant` → Tenant (ManyToOne) - Tenant
- `triggeredBy` → User (ManyToOne, optionnel) - Utilisateur qui a déclenché la notification

**Champs polymorphes:**
- `entityType` + `entityId` - Entité liée à la notification

**Types de notifications:**
- Tâches: TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE, TASK_DUE_SOON
- Commentaires: COMMENT_ADDED, COMMENT_REPLY, MENTION
- Documents: DOCUMENT_SHARED, DOCUMENT_APPROVED, DOCUMENT_REJECTED
- Finances: INVOICE_OVERDUE, PAYMENT_RECEIVED, QUOTE_ACCEPTED
- Équipe: TEAM_MEMBER_ADDED, TEAM_MEMBER_REMOVED
- Portail client: CLIENT_PORTAL_ACCESS

**Cas d'usage:**
- Notifier un utilisateur d'une nouvelle tâche
- Alerter sur une facture en retard
- Informer d'une mention dans un commentaire
- Notifier l'acceptation d'un devis

---

### 4. ActivityLog (Journal d'activité)

**Relations:**
- `user` → User (ManyToOne) - Utilisateur qui a effectué l'action
- `tenant` → Tenant (ManyToOne) - Tenant
- `business` → Business (ManyToOne, optionnel) - Entreprise
- `task` → Task (ManyToOne, optionnel) - Tâche modifiée

**Champs polymorphes:**
- `entityType` + `entityId` - Entité modifiée

**Actions trackées:**
- CREATE, UPDATE, DELETE
- ASSIGN, UNASSIGN, COMPLETE, REOPEN
- APPROVE, REJECT, SEND, RECEIVE
- CANCEL, ARCHIVE, RESTORE
- COMMENT, SHARE, DOWNLOAD, UPLOAD
- LOGIN, LOGOUT

**Cas d'usage:**
- Audit trail complet du système
- Historique des modifications d'un document
- Traçabilité des actions utilisateurs
- Conformité et sécurité

---

### 5. TeamMember (Membres d'équipe)

**Relations:**
- `user` → User (ManyToOne) - Utilisateur membre
- `tenant` → Tenant (ManyToOne) - Tenant
- `business` → Business (ManyToOne, optionnel) - Entreprise spécifique
- `invitedBy` → User (ManyToOne, optionnel) - Utilisateur qui a invité

**Rôles:**
- OWNER - Propriétaire du tenant
- ADMIN - Administrateur complet
- MANAGER - Gestionnaire
- ACCOUNTANT - Comptable
- SALES - Commercial
- PURCHASER - Acheteur
- WAREHOUSE - Magasinier
- MEMBER - Membre standard
- VIEWER - Lecture seule

**Permissions granulaires:**
```typescript
{
  canManageTeam: boolean;
  canManageClients: boolean;
  canManageProducts: boolean;
  canManageSales: boolean;
  canManagePurchases: boolean;
  canManagePayments: boolean;
  canViewReports: boolean;
  canExportData: boolean;
}
```

**Cas d'usage:**
- Gestion des accès multi-utilisateurs
- Permissions par entreprise dans un tenant
- Invitation de nouveaux membres
- Contrôle d'accès granulaire

---

### 6. Invitation (Invitations)

**Relations:**
- `tenant` → Tenant (ManyToOne) - Tenant
- `business` → Business (ManyToOne, optionnel) - Entreprise
- `invitedBy` → User (ManyToOne) - Utilisateur qui invite
- `createdUser` → User (ManyToOne, optionnel) - Utilisateur créé après acceptation

**Types d'invitation:**
- TEAM_MEMBER - Invitation membre d'équipe
- CLIENT_PORTAL - Invitation portail client
- EXTERNAL_COLLABORATOR - Collaborateur externe

**Statuts:**
- PENDING - En attente
- ACCEPTED - Acceptée
- REJECTED - Refusée
- EXPIRED - Expirée
- CANCELLED - Annulée

**Cas d'usage:**
- Inviter un nouveau membre d'équipe
- Donner accès portail à un client
- Inviter un collaborateur externe temporaire

---

### 7. DocumentDiscussion (Discussions sur documents)

**Relations:**
- `tenant` → Tenant (ManyToOne) - Tenant
- `business` → Business (ManyToOne, optionnel) - Entreprise
- `createdBy` → User (ManyToOne) - Créateur de la discussion
- `resolvedBy` → User (ManyToOne, optionnel) - Utilisateur qui a résolu
- `quote` → Quote (ManyToOne, optionnel) - Devis discuté
- `salesOrder` → SalesOrder (ManyToOne, optionnel) - Commande discutée
- `supplierPO` → SupplierPO (ManyToOne, optionnel) - BC discuté
- `purchaseInvoice` → PurchaseInvoice (ManyToOne, optionnel) - Facture discutée

**Champs polymorphes:**
- `documentType` + `documentId` - Document concerné

**Statuts:**
- OPEN - Discussion ouverte
- RESOLVED - Résolue
- CLOSED - Fermée

**Cas d'usage:**
- Discussion sur les termes d'un devis
- Questions sur une commande client
- Clarifications sur une facture fournisseur
- Résolution de litiges
- Validation collaborative de documents

---

### 8. ClientPortalAccess (Accès Portail Client)

**Relations:**
- `client` → Client (ManyToOne) - Client ayant accès
- `business` → Business (ManyToOne) - Entreprise
- `tenant` → Tenant (ManyToOne) - Tenant

**Niveaux d'accès:**
- FULL - Accès complet (devis, commandes, factures, paiements)
- INVOICES_ONLY - Uniquement factures et paiements
- QUOTES_ONLY - Uniquement devis
- READ_ONLY - Lecture seule

**Fonctionnalités:**
- Authentification séparée pour les clients
- Invitation par email avec token
- Réinitialisation de mot de passe
- Tracking des connexions
- Préférences personnalisées

**Cas d'usage:**
- Client consulte ses factures en ligne
- Client accepte/refuse un devis
- Client télécharge ses documents
- Client suit l'état de ses commandes

---

## Relations avec les autres modules

### Module Users
- Toutes les entités collaboration référencent User pour les actions utilisateurs
- User.avatar_url et User.job_title ajoutés pour l'affichage dans les collaborations

### Module Tenants
- Multi-tenancy: toutes les entités collaboration appartiennent à un Tenant
- Isolation des données par tenant

### Module Businesses
- Les collaborations peuvent être liées à une entreprise spécifique
- Utile pour les tenants multi-entreprises

### Module Clients
- Task peut être liée à un client
- ClientPortalAccess donne accès portail aux clients
- Comment peut être sur des documents liés à un client

### Module Sales
- Comment sur Quote, SalesOrder, DeliveryNote
- DocumentDiscussion sur documents de vente
- Task liée aux processus de vente
- ActivityLog pour audit des ventes

### Module Purchases
- Comment sur SupplierPO, PurchaseInvoice
- DocumentDiscussion sur documents d'achat
- Task pour suivi des achats
- ActivityLog pour audit des achats

### Module Payments
- Notification pour paiements reçus
- Task pour suivi des paiements
- ActivityLog pour traçabilité

---

## Indexes pour performance

### Task
- `(tenantId, status)` - Liste des tâches par statut
- `(assignedToId, status)` - Tâches d'un utilisateur
- `(businessId, dueDate)` - Tâches à venir par entreprise

### Comment
- `(entityType, entityId)` - Commentaires d'une entité
- `(userId, createdAt)` - Commentaires d'un utilisateur

### Notification
- `(userId, isRead, createdAt)` - Notifications non lues
- `(tenantId, createdAt)` - Toutes les notifications

### ActivityLog
- `(tenantId, createdAt)` - Journal par tenant
- `(userId, createdAt)` - Actions d'un utilisateur
- `(entityType, entityId)` - Historique d'une entité
- `(businessId, createdAt)` - Journal par entreprise

### TeamMember
- `(tenantId, isActive)` - Membres actifs
- `(businessId, isActive)` - Membres par entreprise
- Unique: `(userId, tenantId, businessId)` - Pas de doublons

### Invitation
- `(email, status)` - Invitations par email
- `(tenantId, status)` - Invitations en attente
- `(token)` - Recherche par token

### DocumentDiscussion
- `(documentType, documentId)` - Discussions d'un document
- `(tenantId, status)` - Discussions ouvertes
- `(businessId, createdAt)` - Discussions par entreprise

### ClientPortalAccess
- `(tenantId, isActive)` - Accès actifs
- `(businessId, isActive)` - Accès par entreprise
- Unique: `(clientId, email)` - Un email par client

---

## Exemples de requêtes courantes

### 1. Récupérer toutes les tâches d'un utilisateur avec leurs commentaires
```typescript
const tasks = await taskRepository.find({
  where: { assignedToId: userId, status: Not(TaskStatus.DONE) },
  relations: ['assignedTo', 'createdBy', 'client', 'comments', 'comments.user'],
  order: { dueDate: 'ASC' }
});
```

### 2. Récupérer les commentaires d'un devis avec les auteurs
```typescript
const comments = await commentRepository.find({
  where: { entityType: CommentEntityType.QUOTE, entityId: quoteId },
  relations: ['user'],
  order: { createdAt: 'ASC' }
});
```

### 3. Récupérer les notifications non lues d'un utilisateur
```typescript
const notifications = await notificationRepository.find({
  where: { userId, isRead: false },
  relations: ['triggeredBy'],
  order: { createdAt: 'DESC' },
  take: 50
});
```

### 4. Journal d'activité d'un document
```typescript
const logs = await activityLogRepository.find({
  where: { entityType: ActivityLogEntityType.QUOTE, entityId: quoteId },
  relations: ['user'],
  order: { createdAt: 'DESC' }
});
```

### 5. Membres actifs d'une entreprise
```typescript
const members = await teamMemberRepository.find({
  where: { businessId, isActive: true },
  relations: ['user'],
  order: { createdAt: 'ASC' }
});
```

### 6. Discussions ouvertes sur les documents d'une entreprise
```typescript
const discussions = await documentDiscussionRepository.find({
  where: { businessId, status: DiscussionStatus.OPEN },
  relations: ['createdBy'],
  order: { createdAt: 'DESC' }
});
```

---

## Migrations recommandées

1. Créer les tables dans l'ordre:
   - team_members
   - tasks
   - comments
   - notifications
   - activity_logs
   - invitations
   - document_discussions
   - client_portal_access

2. Ajouter les indexes après création des tables

3. Ajouter les contraintes de clés étrangères

4. Peupler les données de test si nécessaire

---

## Sécurité et permissions

### Règles d'accès:
1. Toutes les requêtes doivent filtrer par `tenantId`
2. Vérifier les permissions TeamMember avant les actions
3. Les clients ne peuvent accéder qu'à leurs propres données via ClientPortalAccess
4. ActivityLog est en lecture seule (sauf pour les admins)
5. Les notifications sont privées à chaque utilisateur

### Validation:
- Valider que l'utilisateur appartient au tenant
- Valider les permissions pour les actions sensibles
- Valider l'accès aux documents avant de créer des commentaires/discussions
- Valider les tokens d'invitation avant acceptation

---

## Évolutions futures possibles

1. **Webhooks** - Notifications externes sur événements
2. **Intégrations** - Slack, Teams, Email pour notifications
3. **Templates de tâches** - Tâches récurrentes automatiques
4. **Workflows** - Automatisation basée sur les statuts
5. **Analytics** - Tableaux de bord de collaboration
6. **Mentions avancées** - @team, @role
7. **Réactions** - Emojis sur commentaires
8. **Threads** - Fils de discussion structurés
9. **Recherche full-text** - Sur commentaires et discussions
10. **Export** - Rapports d'activité et audit
