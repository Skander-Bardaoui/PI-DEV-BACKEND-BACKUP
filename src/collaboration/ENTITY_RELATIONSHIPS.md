# Diagramme des Relations - Module Collaboration

## Vue d'ensemble ASCII

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTÈME DE COLLABORATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   TENANT     │ (Multi-tenancy)
│   - id       │
│   - name     │
└──────┬───────┘
       │
       │ (1:N)
       │
       ├─────────────────────────────────────────────────────────────┐
       │                                                               │
       ▼                                                               ▼
┌──────────────┐                                              ┌──────────────┐
│   BUSINESS   │                                              │     USER     │
│   - id       │                                              │   - id       │
│   - name     │                                              │   - email    │
│   - tenant_id│                                              │   - name     │
└──────┬───────┘                                              │   - role     │
       │                                                       └──────┬───────┘
       │                                                              │
       │                                                              │
       └──────────────────────────┬───────────────────────────────────┘
                                  │
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌──────────────┐          ┌──────────────┐         ┌──────────────┐
│ TEAM_MEMBER  │          │     TASK     │         │  INVITATION  │
│   - id       │          │   - id       │         │   - id       │
│   - user_id  │◄─────────┤   - title    │         │   - email    │
│   - tenant_id│          │   - status   │         │   - token    │
│   - role     │          │   - assigned │         │   - status   │
│   - perms    │          │   - due_date │         │   - type     │
└──────────────┘          └──────┬───────┘         └──────────────┘
                                 │
                                 │ (1:N)
                                 │
                    ┌────────────┼────────────┐
                    │                         │
                    ▼                         ▼
            ┌──────────────┐          ┌──────────────┐
            │   COMMENT    │          │ ACTIVITY_LOG │
            │   - id       │          │   - id       │
            │   - content  │          │   - action   │
            │   - entity   │          │   - entity   │
            │   - mentions │          │   - old/new  │
            └──────────────┘          └──────────────┘
```

## Relations détaillées par entité

### 1. TASK (Tâches)

```
                    ┌──────────────────────────┐
                    │         TASK             │
                    │  - id                    │
                    │  - title                 │
                    │  - status                │
                    │  - priority              │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│ assignedTo   │     │  createdBy   │    │   tenant     │
│   (User)     │     │   (User)     │    │  (Tenant)    │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ (optionnel)
        │
        ├────────────────────┬────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│   business   │     │    client    │    │ relatedEntity│
│  (Business)  │     │   (Client)   │    │ (polymorphe) │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ (1:N)
        │
        ├────────────────────┬────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│   comments   │     │ activityLogs │    │notifications │
│  (Comment[]) │     │(ActivityLog[])│   │(Notification)│
└──────────────┘     └──────────────┘    └──────────────┘
```

### 2. COMMENT (Commentaires)

```
                    ┌──────────────────────────┐
                    │       COMMENT            │
                    │  - id                    │
                    │  - content               │
                    │  - entityType            │
                    │  - entityId              │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│     user     │     │ mentionedUsers│   │  attachments │
│   (User)     │     │   (User[])   │    │   (JSON)     │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Relations polymorphes (selon entityType)
        │
        ├────────┬────────┬────────┬────────┬────────┐
        │        │        │        │        │        │
        ▼        ▼        ▼        ▼        ▼        ▼
    ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐
    │Task│  │Quote│ │Sales│ │Supp│  │Purch│ │Client│
    │    │  │     │ │Order│ │PO  │  │Inv  │ │      │
    └────┘  └────┘  └────┘  └────┘  └────┘  └────┘
```

### 3. NOTIFICATION (Notifications)

```
                    ┌──────────────────────────┐
                    │     NOTIFICATION         │
                    │  - id                    │
                    │  - type                  │
                    │  - message               │
                    │  - isRead                │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│     user     │     │ triggeredBy  │    │   tenant     │
│ (destinataire)│    │   (User)     │    │  (Tenant)    │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Lien polymorphe vers entité
        │
        ▼
┌──────────────────────────┐
│  entityType + entityId   │
│  (Task, Quote, Invoice,  │
│   Payment, etc.)         │
└──────────────────────────┘

Types de notifications:
├─ TASK_ASSIGNED
├─ TASK_COMPLETED
├─ TASK_OVERDUE
├─ COMMENT_ADDED
├─ MENTION
├─ DOCUMENT_SHARED
├─ INVOICE_OVERDUE
├─ PAYMENT_RECEIVED
└─ QUOTE_ACCEPTED
```

### 4. ACTIVITY_LOG (Journal d'activité)

```
                    ┌──────────────────────────┐
                    │     ACTIVITY_LOG         │
                    │  - id                    │
                    │  - action                │
                    │  - oldValue              │
                    │  - newValue              │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│     user     │     │   tenant     │    │   business   │
│ (qui a agi)  │     │  (Tenant)    │    │  (Business)  │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Entité modifiée (polymorphe)
        │
        ▼
┌──────────────────────────┐
│  entityType + entityId   │
│  + metadata              │
│  + ipAddress             │
│  + userAgent             │
└──────────────────────────┘

Actions trackées:
├─ CREATE, UPDATE, DELETE
├─ ASSIGN, UNASSIGN
├─ COMPLETE, REOPEN
├─ APPROVE, REJECT
├─ SEND, RECEIVE
├─ CANCEL, ARCHIVE
└─ LOGIN, LOGOUT
```

### 5. TEAM_MEMBER (Membres d'équipe)

```
                    ┌──────────────────────────┐
                    │     TEAM_MEMBER          │
                    │  - id                    │
                    │  - role                  │
                    │  - permissions           │
                    │  - isActive              │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│     user     │     │   tenant     │    │   business   │
│   (User)     │     │  (Tenant)    │    │  (Business)  │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Invitation
        │
        ▼
┌──────────────────────────┐
│  invitedBy (User)        │
│  invitationToken         │
│  invitationSentAt        │
│  invitationAcceptedAt    │
└──────────────────────────┘

Rôles disponibles:
├─ OWNER (propriétaire)
├─ ADMIN (administrateur)
├─ MANAGER (gestionnaire)
├─ ACCOUNTANT (comptable)
├─ SALES (commercial)
├─ PURCHASER (acheteur)
├─ WAREHOUSE (magasinier)
├─ MEMBER (membre)
└─ VIEWER (lecture seule)

Permissions granulaires:
├─ canManageTeam
├─ canManageClients
├─ canManageProducts
├─ canManageSales
├─ canManagePurchases
├─ canManagePayments
├─ canViewReports
└─ canExportData
```

### 6. INVITATION (Invitations)

```
                    ┌──────────────────────────┐
                    │      INVITATION          │
                    │  - id                    │
                    │  - email                 │
                    │  - token                 │
                    │  - status                │
                    │  - type                  │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│  invitedBy   │     │   tenant     │    │   business   │
│   (User)     │     │  (Tenant)    │    │  (Business)  │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Après acceptation
        │
        ▼
┌──────────────────────────┐
│  createdUser (User)      │
│  acceptedAt              │
│  proposedRole            │
│  proposedPermissions     │
└──────────────────────────┘

Types d'invitation:
├─ TEAM_MEMBER (membre équipe)
├─ CLIENT_PORTAL (portail client)
└─ EXTERNAL_COLLABORATOR (collaborateur externe)

Statuts:
├─ PENDING (en attente)
├─ ACCEPTED (acceptée)
├─ REJECTED (refusée)
├─ EXPIRED (expirée)
└─ CANCELLED (annulée)
```

### 7. DOCUMENT_DISCUSSION (Discussions sur documents)

```
                    ┌──────────────────────────┐
                    │  DOCUMENT_DISCUSSION     │
                    │  - id                    │
                    │  - title                 │
                    │  - status                │
                    │  - documentType          │
                    │  - documentId            │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│  createdBy   │     │   tenant     │    │   business   │
│   (User)     │     │  (Tenant)    │    │  (Business)  │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Participants et résolution
        │
        ├────────────────────┬────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│participantIds│     │  resolvedBy  │    │  attachments │
│   (User[])   │     │   (User)     │    │   (JSON)     │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Document lié (polymorphe)
        │
        ├────────┬────────┬────────┬────────┐
        │        │        │        │        │
        ▼        ▼        ▼        ▼        ▼
    ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐
    │Quote│ │Sales│ │Supp│  │Purch│ │Other│
    │     │ │Order│ │PO  │  │Inv  │ │     │
    └────┘  └────┘  └────┘  └────┘  └────┘

Statuts:
├─ OPEN (ouverte)
├─ RESOLVED (résolue)
└─ CLOSED (fermée)
```

### 8. CLIENT_PORTAL_ACCESS (Accès Portail Client)

```
                    ┌──────────────────────────┐
                    │  CLIENT_PORTAL_ACCESS    │
                    │  - id                    │
                    │  - email                 │
                    │  - password_hash         │
                    │  - accessLevel           │
                    │  - isActive              │
                    └────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│    client    │     │   business   │    │   tenant     │
│   (Client)   │     │  (Business)  │    │  (Tenant)    │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Invitation et sécurité
        │
        ├────────────────────┬────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│invitationToken│    │resetPassword │    │  lastLogin   │
│invitationSent│     │    Token     │    │  lastLoginIp │
└──────────────┘     └──────────────┘    └──────────────┘
        │
        │ Préférences
        │
        ▼
┌──────────────────────────┐
│  preferences (JSON)      │
│  - language              │
│  - emailNotifications    │
│  - documentDownload...   │
└──────────────────────────┘

Niveaux d'accès:
├─ FULL (complet)
├─ INVOICES_ONLY (factures uniquement)
├─ QUOTES_ONLY (devis uniquement)
└─ READ_ONLY (lecture seule)
```

## Flux de données principaux

### Flux 1: Création d'une tâche avec notification

```
User crée Task
    │
    ├─> Task.save()
    │
    ├─> ActivityLog.create(action: CREATE)
    │
    ├─> Notification.create(type: TASK_ASSIGNED)
    │       │
    │       └─> Envoi email/push
    │
    └─> Retour Task avec relations
```

### Flux 2: Commentaire avec mention

```
User ajoute Comment
    │
    ├─> Comment.save(mentionedUserIds: [...])
    │
    ├─> ActivityLog.create(action: COMMENT)
    │
    ├─> Pour chaque mention:
    │       │
    │       └─> Notification.create(type: MENTION)
    │               │
    │               └─> Envoi notification
    │
    └─> Retour Comment
```

### Flux 3: Invitation membre d'équipe

```
Admin crée Invitation
    │
    ├─> Invitation.save(token: uuid, status: PENDING)
    │
    ├─> Envoi email avec lien
    │
    └─> User clique lien
            │
            ├─> Validation token
            │
            ├─> User.create() ou User.find()
            │
            ├─> TeamMember.create()
            │
            ├─> Invitation.update(status: ACCEPTED)
            │
            ├─> ActivityLog.create(action: TEAM_MEMBER_ADDED)
            │
            └─> Notification aux admins
```

### Flux 4: Discussion sur document

```
User crée DocumentDiscussion
    │
    ├─> DocumentDiscussion.save()
    │
    ├─> Pour chaque participant:
    │       │
    │       └─> Notification.create(type: DOCUMENT_SHARED)
    │
    └─> User ajoute Comment
            │
            ├─> Comment.save(entityType: DOCUMENT_DISCUSSION)
            │
            └─> Notification aux participants
```

### Flux 5: Accès portail client

```
Business invite Client
    │
    ├─> ClientPortalAccess.create(invitationToken: uuid)
    │
    ├─> Envoi email invitation
    │
    └─> Client clique lien
            │
            ├─> Validation token
            │
            ├─> Client définit mot de passe
            │
            ├─> ClientPortalAccess.update(password_hash, acceptedAt)
            │
            ├─> Client.update(has_portal_access: true)
            │
            └─> Client peut se connecter
                    │
                    ├─> Voir ses factures
                    ├─> Télécharger documents
                    ├─> Accepter/refuser devis
                    └─> Voir historique paiements
```

## Matrice des permissions

```
┌──────────────┬──────┬──────┬────────┬──────────┬──────┬─────────┬─────────┬────────┬────────┐
│ Action       │OWNER │ADMIN │MANAGER │ACCOUNTANT│SALES │PURCHASER│WAREHOUSE│MEMBER  │VIEWER  │
├──────────────┼──────┼──────┼────────┼──────────┼──────┼─────────┼─────────┼────────┼────────┤
│Manage Team   │  ✓   │  ✓   │   ✗    │    ✗     │  ✗   │    ✗    │    ✗    │   ✗    │   ✗    │
│Manage Clients│  ✓   │  ✓   │   ✓    │    ✗     │  ✓   │    ✗    │    ✗    │   ✗    │   ✗    │
│Manage Sales  │  ✓   │  ✓   │   ✓    │    ✗     │  ✓   │    ✗    │    ✗    │   ✗    │   ✗    │
│Manage Purch. │  ✓   │  ✓   │   ✓    │    ✗     │  ✗   │    ✓    │    ✗    │   ✗    │   ✗    │
│Manage Pay.   │  ✓   │  ✓   │   ✓    │    ✓     │  ✗   │    ✗    │    ✗    │   ✗    │   ✗    │
│View Reports  │  ✓   │  ✓   │   ✓    │    ✓     │  ✓   │    ✓    │    ✗    │   ✗    │   ✗    │
│Export Data   │  ✓   │  ✓   │   ✓    │    ✓     │  ✗   │    ✗    │    ✗    │   ✗    │   ✗    │
│Create Tasks  │  ✓   │  ✓   │   ✓    │    ✓     │  ✓   │    ✓    │    ✓    │   ✓    │   ✗    │
│Comment       │  ✓   │  ✓   │   ✓    │    ✓     │  ✓   │    ✓    │    ✓    │   ✓    │   ✗    │
│View Only     │  ✓   │  ✓   │   ✓    │    ✓     │  ✓   │    ✓    │    ✓    │   ✓    │   ✓    │
└──────────────┴──────┴──────┴────────┴──────────┴──────┴─────────┴─────────┴────────┴────────┘
```

## Résumé des cardinalités

```
User ──────────< TeamMember >────────── Tenant
User ──────────< Task (assigned)
User ──────────< Task (created)
User ──────────< Comment
User ──────────< Notification
User ──────────< ActivityLog
User ──────────< Invitation (invitedBy)
User ──────────< DocumentDiscussion (createdBy)

Tenant ────────< Business
Tenant ────────< TeamMember
Tenant ────────< Task
Tenant ────────< Notification
Tenant ────────< ActivityLog
Tenant ────────< Invitation
Tenant ────────< DocumentDiscussion
Tenant ────────< ClientPortalAccess

Business ──────< Client
Business ──────< Task (optionnel)
Business ──────< TeamMember (optionnel)
Business ──────< DocumentDiscussion (optionnel)
Business ──────< ClientPortalAccess

Client ────────< Task (optionnel)
Client ────────< ClientPortalAccess

Task ──────────< Comment
Task ──────────< ActivityLog

Quote ─────────< Comment (polymorphe)
Quote ─────────< DocumentDiscussion (polymorphe)
Quote ─────────< Task (relatedEntity, polymorphe)

SalesOrder ────< Comment (polymorphe)
SalesOrder ────< DocumentDiscussion (polymorphe)

SupplierPO ────< Comment (polymorphe)
SupplierPO ────< DocumentDiscussion (polymorphe)

PurchaseInvoice < Comment (polymorphe)
PurchaseInvoice < DocumentDiscussion (polymorphe)
```

## Légende

```
─────────< : Relation One-to-Many (1:N)
>─────────< : Relation Many-to-Many (N:N)
- - - - - > : Relation optionnelle
═════════> : Relation polymorphe
```
