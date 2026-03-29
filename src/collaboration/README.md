# Module Collaboration - Documentation Complète

## 📋 Vue d'ensemble

Le module Collaboration fournit une infrastructure complète pour la gestion des tâches, commentaires, notifications, journal d'activité, gestion d'équipe, invitations, discussions sur documents et portail client dans votre application ERP multi-tenant.

## 🎯 Fonctionnalités principales

### 1. Gestion des Tâches
- Création et assignation de tâches
- Statuts: TODO, IN_PROGRESS, DONE, BLOCKED
- Priorités: LOW, MEDIUM, HIGH, URGENT
- Lien avec documents (devis, commandes, factures, etc.)
- Dates d'échéance et rappels
- Tâches auto-générées par le système

### 2. Système de Commentaires
- Commentaires sur n'importe quelle entité (polymorphe)
- Mentions d'utilisateurs (@user)
- Pièces jointes
- Commentaires imbriqués (threads)
- Soft delete et édition

### 3. Notifications
- 15+ types de notifications
- Notifications en temps réel
- Marquage lu/non lu
- Archivage
- Liens d'action directs

### 4. Journal d'Activité
- Audit trail complet
- Tracking des modifications (old/new values)
- Métadonnées (IP, user agent)
- Support de 15+ types d'entités
- 15+ types d'actions

### 5. Gestion d'Équipe
- 9 rôles prédéfinis
- Permissions granulaires
- Invitations par email
- Multi-entreprise par tenant
- Tracking des accès

### 6. Système d'Invitations
- 3 types: Team Member, Client Portal, External Collaborator
- Tokens sécurisés avec expiration
- Statuts: PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED
- Messages personnalisés

### 7. Discussions sur Documents
- Discussions contextuelles sur documents
- Participants multiples
- Statuts: OPEN, RESOLVED, CLOSED
- Pièces jointes
- Notes de résolution

### 8. Portail Client
- Accès sécurisé pour les clients
- 4 niveaux d'accès
- Authentification séparée
- Préférences personnalisées
- Tracking des connexions

## 📁 Structure des fichiers

```
src/collaboration/
├── entities/
│   ├── task.entity.ts                    # Tâches
│   ├── comment.entity.ts                 # Commentaires
│   ├── notification.entity.ts            # Notifications
│   ├── activity-log.entity.ts            # Journal d'activité
│   ├── team-member.entity.ts             # Membres d'équipe
│   ├── invitation.entity.ts              # Invitations
│   ├── document-discussion.entity.ts     # Discussions
│   ├── client-portal-access.entity.ts    # Portail client
│   └── index.ts                          # Exports
├── dto/
│   ├── create-task.dto.ts
│   ├── update-task.dto.ts
│   ├── create-comment.dto.ts
│   ├── create-notification.dto.ts
│   ├── create-team-member.dto.ts
│   ├── update-team-member.dto.ts
│   ├── create-invitation.dto.ts
│   ├── create-document-discussion.dto.ts
│   ├── update-document-discussion.dto.ts
│   ├── create-client-portal-access.dto.ts
│   └── index.ts
├── RELATIONS_SCHEMA.md                   # Schéma complet des relations
├── ENTITY_RELATIONSHIPS.md               # Diagrammes visuels
├── MIGRATION_GUIDE.md                    # Guide de migration SQL
├── QUICK_REFERENCE.md                    # Référence rapide pour devs
└── README.md                             # Ce fichier
```

## 🚀 Démarrage rapide

### 1. Installation

Les entités sont déjà créées. Il faut maintenant:

1. Exécuter les migrations SQL (voir `MIGRATION_GUIDE.md`)
2. Importer les entités dans votre module
3. Créer les services et contrôleurs

### 2. Import des entités

```typescript
// app.module.ts
import {
  Task,
  Comment,
  Notification,
  ActivityLog,
  TeamMember,
  Invitation,
  DocumentDiscussion,
  ClientPortalAccess,
} from './collaboration/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Comment,
      Notification,
      ActivityLog,
      TeamMember,
      Invitation,
      DocumentDiscussion,
      ClientPortalAccess,
    ]),
  ],
})
export class CollaborationModule {}
```

### 3. Exemple d'utilisation

```typescript
// Créer une tâche
const task = await taskRepository.save({
  title: 'Valider le devis #2024-001',
  assignedToId: userId,
  tenantId: tenantId,
  status: TaskStatus.TODO,
  priority: TaskPriority.HIGH,
  dueDate: new Date('2024-12-31'),
});

// Ajouter un commentaire
const comment = await commentRepository.save({
  userId: currentUserId,
  entityType: CommentEntityType.TASK,
  entityId: task.id,
  content: 'Tâche créée automatiquement',
});

// Créer une notification
const notification = await notificationRepository.save({
  userId: task.assignedToId,
  tenantId: tenantId,
  type: NotificationType.TASK_ASSIGNED,
  entityType: NotificationEntityType.TASK,
  entityId: task.id,
  message: 'Nouvelle tâche assignée',
});
```

## 📚 Documentation détaillée

### Guides disponibles

1. **RELATIONS_SCHEMA.md** - Documentation complète des relations
   - Description de chaque entité
   - Relations avec les autres modules
   - Exemples de requêtes
   - Règles de sécurité

2. **ENTITY_RELATIONSHIPS.md** - Diagrammes visuels
   - Diagrammes ASCII des relations
   - Flux de données
   - Matrice des permissions
   - Cardinalités

3. **MIGRATION_GUIDE.md** - Guide de migration
   - Scripts SQL complets
   - Ordre de création des tables
   - Indexes et contraintes
   - Rollback et troubleshooting

4. **QUICK_REFERENCE.md** - Référence rapide
   - Exemples de code
   - Requêtes courantes
   - Guards et permissions
   - Bonnes pratiques

## 🔐 Sécurité et Permissions

### Multi-tenancy

Toutes les entités sont isolées par `tenantId`. Toujours filtrer par tenant:

```typescript
// ✅ BON
const tasks = await taskRepository.find({
  where: { tenantId, userId },
});

// ❌ MAUVAIS
const tasks = await taskRepository.find({
  where: { userId },
});
```

### Rôles et Permissions

9 rôles disponibles avec permissions granulaires:

- **OWNER** - Propriétaire (toutes permissions)
- **ADMIN** - Administrateur (toutes permissions)
- **MANAGER** - Gestionnaire
- **ACCOUNTANT** - Comptable
- **SALES** - Commercial
- **PURCHASER** - Acheteur
- **WAREHOUSE** - Magasinier
- **MEMBER** - Membre standard
- **VIEWER** - Lecture seule

Permissions granulaires:
- `canManageTeam`
- `canManageClients`
- `canManageProducts`
- `canManageSales`
- `canManagePurchases`
- `canManagePayments`
- `canViewReports`
- `canExportData`

## 🔗 Relations avec les autres modules

### Module Users
- Toutes les actions utilisateurs sont trackées
- Relations: assignedTo, createdBy, triggeredBy, etc.

### Module Tenants
- Multi-tenancy complet
- Isolation des données

### Module Businesses
- Support multi-entreprise par tenant
- Permissions par entreprise

### Module Clients
- Tâches liées aux clients
- Portail client sécurisé

### Module Sales
- Commentaires sur devis, commandes
- Discussions sur documents de vente
- Tâches de suivi commercial

### Module Purchases
- Commentaires sur BC, factures fournisseurs
- Discussions sur achats
- Tâches de suivi achats

## 📊 Indexes pour performance

Tous les indexes nécessaires sont documentés dans `MIGRATION_GUIDE.md`:

- Index composites pour les requêtes fréquentes
- Index sur les clés étrangères
- Index sur les champs de filtrage (status, isRead, etc.)
- Contraintes UNIQUE pour éviter les doublons

## 🧪 Tests

### Tests unitaires

```typescript
describe('TaskService', () => {
  it('should create a task', async () => {
    const task = await service.createTask(dto);
    expect(task).toBeDefined();
    expect(task.status).toBe(TaskStatus.TODO);
  });
});
```

### Tests d'intégration

```typescript
describe('Task API', () => {
  it('POST /tasks should create a task', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .send(createTaskDto)
      .expect(201);

    expect(response.body.id).toBeDefined();
  });
});
```

## 🎨 Cas d'usage

### 1. Workflow de validation de devis

```typescript
// 1. Créer une tâche de validation
const task = await createTask({
  title: 'Valider devis #2024-001',
  relatedEntityType: TaskEntityType.QUOTE,
  relatedEntityId: quoteId,
  assignedToId: managerId,
});

// 2. Le manager ajoute un commentaire
await createComment({
  entityType: CommentEntityType.TASK,
  entityId: task.id,
  content: 'Prix validés, en attente signature',
});

// 3. Notification automatique
await createNotification({
  userId: salesPersonId,
  type: NotificationType.COMMENT_ADDED,
  message: 'Nouveau commentaire sur votre tâche',
});

// 4. Logger l'activité
await logActivity({
  action: ActivityLogAction.COMPLETE,
  entityType: ActivityLogEntityType.TASK,
  entityId: task.id,
});
```

### 2. Discussion sur facture fournisseur

```typescript
// 1. Créer une discussion
const discussion = await createDocumentDiscussion({
  documentType: DocumentType.PURCHASE_INVOICE,
  documentId: invoiceId,
  title: 'Montant incorrect',
  participantIds: [accountantId, purchaserId],
});

// 2. Ajouter des commentaires
await createComment({
  entityType: CommentEntityType.PURCHASE_INVOICE,
  entityId: invoiceId,
  content: 'Le montant ne correspond pas au BC',
  mentionedUserIds: [purchaserId],
});

// 3. Résoudre la discussion
await resolveDiscussion(discussion.id, {
  resolvedById: accountantId,
  resolutionNote: 'Facture corrigée par le fournisseur',
});
```

### 3. Invitation membre d'équipe

```typescript
// 1. Créer l'invitation
const invitation = await createInvitation({
  type: InvitationType.TEAM_MEMBER,
  email: 'nouveau@example.com',
  proposedRole: TeamMemberRole.SALES,
  proposedPermissions: {
    canManageClients: true,
    canManageSales: true,
  },
});

// 2. Envoyer l'email
await emailService.sendInvitation(invitation);

// 3. Acceptation par l'utilisateur
await acceptInvitation(invitation.token, {
  password: 'secure-password',
});

// 4. Création automatique du TeamMember
// 5. Notification aux admins
```

### 4. Portail client

```typescript
// 1. Créer l'accès portail
const portalAccess = await createClientPortalAccess({
  clientId: clientId,
  email: client.email,
  accessLevel: ClientPortalAccessLevel.FULL,
});

// 2. Envoyer l'invitation
await emailService.sendClientPortalInvitation(portalAccess);

// 3. Client se connecte
const access = await verifyClientPortalAccess(email, password);

// 4. Client consulte ses documents
const invoices = await getClientInvoices(access.clientId);
const quotes = await getClientQuotes(access.clientId);
```

## 🔄 Événements et Webhooks

Le système peut émettre des événements pour intégration externe:

```typescript
// Émettre un événement
eventEmitter.emit('task.created', { task, userId, tenantId });
eventEmitter.emit('comment.added', { comment, entityType, entityId });
eventEmitter.emit('notification.sent', { notification, userId });

// Écouter les événements
@OnEvent('task.created')
async handleTaskCreated(payload) {
  // Envoyer email, webhook, etc.
}
```

## 📈 Métriques et Analytics

Exemples de métriques à tracker:

- Nombre de tâches par utilisateur
- Taux de complétion des tâches
- Temps moyen de résolution
- Nombre de commentaires par document
- Taux d'engagement des notifications
- Activité par utilisateur/équipe
- Utilisation du portail client

## 🛠️ Maintenance

### Nettoyage des données

```typescript
// Supprimer les notifications anciennes
await notificationRepository.delete({
  createdAt: LessThan(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
  isRead: true,
});

// Archiver les tâches complétées
await taskRepository.update(
  {
    status: TaskStatus.DONE,
    completedAt: LessThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  },
  { isArchived: true }
);

// Expirer les invitations
await invitationRepository.update(
  {
    status: InvitationStatus.PENDING,
    expiresAt: LessThan(new Date()),
  },
  { status: InvitationStatus.EXPIRED }
);
```

## 🐛 Troubleshooting

### Problèmes courants

1. **Erreur: relation does not exist**
   - Vérifier que les migrations sont exécutées
   - Vérifier l'ordre de création des tables

2. **Erreur: foreign key constraint**
   - Vérifier que les IDs référencés existent
   - Utiliser les transactions pour les opérations multiples

3. **Performance lente**
   - Vérifier que les indexes sont créés
   - Utiliser EXPLAIN ANALYZE sur les requêtes
   - Paginer les résultats

4. **Fuite de données entre tenants**
   - Toujours filtrer par tenantId
   - Utiliser les guards de sécurité

## 📞 Support

Pour toute question ou problème:

1. Consulter la documentation dans ce dossier
2. Vérifier les exemples dans `QUICK_REFERENCE.md`
3. Consulter les diagrammes dans `ENTITY_RELATIONSHIPS.md`
4. Suivre le guide de migration dans `MIGRATION_GUIDE.md`

## 🎯 Prochaines étapes

1. ✅ Entités créées avec relations complètes
2. ⏳ Créer les services pour chaque entité
3. ⏳ Créer les contrôleurs avec endpoints API
4. ⏳ Implémenter les guards de permissions
5. ⏳ Ajouter les tests unitaires et d'intégration
6. ⏳ Documenter les API avec Swagger
7. ⏳ Implémenter les webhooks
8. ⏳ Ajouter la recherche full-text
9. ⏳ Créer les interfaces frontend

## 📝 Changelog

### Version 1.0.0 (Initial)

- ✅ 8 entités créées avec relations complètes
- ✅ Support multi-tenant
- ✅ Permissions granulaires
- ✅ Relations polymorphes
- ✅ Indexes optimisés
- ✅ Documentation complète
- ✅ Exemples de code
- ✅ Guide de migration

## 📄 Licence

Ce module fait partie de votre application ERP.
