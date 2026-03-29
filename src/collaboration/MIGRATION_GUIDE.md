# Guide de Migration - Module Collaboration

## Ordre de création des tables

Pour éviter les erreurs de clés étrangères, créez les tables dans cet ordre:

### 1. Tables de base (déjà existantes)
- `users`
- `tenants`
- `businesses`
- `clients`

### 2. Tables collaboration (à créer)

```sql
-- 1. Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  permissions JSONB,
  is_active BOOLEAN DEFAULT true,
  invitation_token VARCHAR,
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  invited_by_id UUID REFERENCES users(id),
  last_access_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, business_id)
);

CREATE INDEX idx_team_members_tenant_active ON team_members(tenant_id, is_active);
CREATE INDEX idx_team_members_business_active ON team_members(business_id, is_active);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- 2. Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR NOT NULL DEFAULT 'TODO',
  priority VARCHAR NOT NULL DEFAULT 'MEDIUM',
  assigned_to_id UUID NOT NULL REFERENCES users(id),
  created_by_id UUID REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id),
  client_id UUID REFERENCES clients(id),
  related_entity_type VARCHAR,
  related_entity_id UUID,
  due_date DATE,
  is_auto_generated BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to_id, status);
CREATE INDEX idx_tasks_business_due ON tasks(business_id, due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_id);

-- 3. Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentioned_user_ids TEXT[],
  attachments JSONB,
  is_deleted BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_user_created ON comments(user_id, created_at);
CREATE INDEX idx_comments_entity_id ON comments(entity_id);

-- 4. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  triggered_by_id UUID REFERENCES users(id),
  type VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id UUID NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);
CREATE INDEX idx_notifications_tenant_created ON notifications(tenant_id, created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- 5. Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id),
  entity_type VARCHAR NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR NOT NULL,
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  ip_address VARCHAR,
  user_agent VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_tenant_created ON activity_logs(tenant_id, created_at);
CREATE INDEX idx_activity_logs_user_created ON activity_logs(user_id, created_at);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_business_created ON activity_logs(business_id, created_at);

-- 6. Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id),
  type VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  name VARCHAR,
  token VARCHAR UNIQUE NOT NULL,
  status VARCHAR DEFAULT 'PENDING',
  invited_by_id UUID NOT NULL REFERENCES users(id),
  proposed_role VARCHAR,
  proposed_permissions JSONB,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_email_status ON invitations(email, status);
CREATE INDEX idx_invitations_tenant_status ON invitations(tenant_id, status);
CREATE INDEX idx_invitations_token ON invitations(token);

-- 7. Document Discussions
CREATE TABLE document_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id),
  document_type VARCHAR NOT NULL,
  document_id UUID NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'OPEN',
  created_by_id UUID NOT NULL REFERENCES users(id),
  participant_ids TEXT[] NOT NULL,
  resolved_by_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_discussions_document ON document_discussions(document_type, document_id);
CREATE INDEX idx_document_discussions_tenant_status ON document_discussions(tenant_id, status);
CREATE INDEX idx_document_discussions_business_created ON document_discussions(business_id, created_at);
CREATE INDEX idx_document_discussions_document_id ON document_discussions(document_id);

-- 8. Client Portal Access
CREATE TABLE client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  password_hash VARCHAR,
  access_level VARCHAR DEFAULT 'FULL',
  is_active BOOLEAN DEFAULT true,
  invitation_token VARCHAR,
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  reset_password_token VARCHAR,
  reset_password_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, email)
);

CREATE INDEX idx_client_portal_tenant_active ON client_portal_access(tenant_id, is_active);
CREATE INDEX idx_client_portal_business_active ON client_portal_access(business_id, is_active);
CREATE INDEX idx_client_portal_client ON client_portal_access(client_id);
```

## Modifications des tables existantes

### Table `users`
```sql
-- Ajouter des colonnes pour la collaboration
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR;
```

### Table `clients`
```sql
-- Ajouter un flag pour l'accès portail
ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_portal_access BOOLEAN DEFAULT false;
```

## TypeORM Synchronization

Si vous utilisez TypeORM avec `synchronize: true` (développement uniquement):

```typescript
// app.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
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
    TypeOrmModule.forRoot({
      // ... autres configs
      entities: [
        // Entités existantes
        User,
        Tenant,
        Business,
        Client,
        // Nouvelles entités collaboration
        Task,
        Comment,
        Notification,
        ActivityLog,
        TeamMember,
        Invitation,
        DocumentDiscussion,
        ClientPortalAccess,
      ],
      synchronize: false, // IMPORTANT: false en production!
    }),
  ],
})
export class AppModule {}
```

## Migration avec TypeORM CLI

### 1. Générer la migration
```bash
npm run typeorm migration:generate -- -n AddCollaborationEntities
```

### 2. Exécuter la migration
```bash
npm run typeorm migration:run
```

### 3. Rollback si nécessaire
```bash
npm run typeorm migration:revert
```

## Données de test

### Créer un membre d'équipe
```typescript
const teamMember = teamMemberRepository.create({
  userId: user.id,
  tenantId: tenant.id,
  businessId: business.id,
  role: TeamMemberRole.MANAGER,
  permissions: {
    canManageClients: true,
    canManageSales: true,
  },
  isActive: true,
});
await teamMemberRepository.save(teamMember);
```

### Créer une tâche
```typescript
const task = taskRepository.create({
  title: 'Valider le devis #2024-001',
  description: 'Vérifier les prix et conditions',
  status: TaskStatus.TODO,
  priority: TaskPriority.HIGH,
  assignedToId: user.id,
  createdById: currentUser.id,
  tenantId: tenant.id,
  businessId: business.id,
  relatedEntityType: TaskEntityType.QUOTE,
  relatedEntityId: quote.id,
  dueDate: new Date('2024-12-31'),
});
await taskRepository.save(task);
```

### Créer un commentaire
```typescript
const comment = commentRepository.create({
  userId: user.id,
  entityType: CommentEntityType.QUOTE,
  entityId: quote.id,
  content: 'Le client demande une remise de 10%',
  mentionedUserIds: [manager.id],
});
await commentRepository.save(comment);
```

### Créer une notification
```typescript
const notification = notificationRepository.create({
  userId: user.id,
  tenantId: tenant.id,
  triggeredById: currentUser.id,
  type: NotificationType.TASK_ASSIGNED,
  entityType: NotificationEntityType.TASK,
  entityId: task.id,
  message: `${currentUser.name} vous a assigné une nouvelle tâche`,
  actionUrl: `/tasks/${task.id}`,
});
await notificationRepository.save(notification);
```

### Créer un accès portail client
```typescript
const portalAccess = clientPortalAccessRepository.create({
  clientId: client.id,
  businessId: business.id,
  tenantId: tenant.id,
  email: client.email,
  accessLevel: ClientPortalAccessLevel.FULL,
  invitationToken: generateToken(),
  invitationSentAt: new Date(),
  preferences: {
    language: 'fr',
    emailNotifications: true,
  },
});
await clientPortalAccessRepository.save(portalAccess);
```

## Vérification post-migration

### 1. Vérifier les tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%collaboration%' 
OR table_name IN ('tasks', 'comments', 'notifications', 'activity_logs', 'team_members', 'invitations', 'document_discussions', 'client_portal_access');
```

### 2. Vérifier les indexes
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('tasks', 'comments', 'notifications', 'activity_logs', 'team_members', 'invitations', 'document_discussions', 'client_portal_access');
```

### 3. Vérifier les contraintes
```sql
SELECT conname, contype, conrelid::regclass 
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('tasks', 'comments', 'notifications', 'activity_logs', 'team_members', 'invitations', 'document_discussions', 'client_portal_access');
```

## Rollback complet

Si vous devez annuler toutes les modifications:

```sql
-- Supprimer les tables dans l'ordre inverse
DROP TABLE IF EXISTS client_portal_access CASCADE;
DROP TABLE IF EXISTS document_discussions CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;

-- Supprimer les colonnes ajoutées
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS job_title;
ALTER TABLE clients DROP COLUMN IF EXISTS has_portal_access;
```

## Troubleshooting

### Erreur: relation does not exist
- Vérifiez que les tables de base (users, tenants, businesses, clients) existent
- Créez les tables dans l'ordre spécifié

### Erreur: foreign key constraint
- Vérifiez que les IDs référencés existent
- Utilisez ON DELETE CASCADE pour les relations parent-enfant

### Erreur: duplicate key value
- Vérifiez les contraintes UNIQUE
- Pour team_members: un user ne peut être membre qu'une fois par tenant/business

### Performance lente
- Vérifiez que tous les indexes sont créés
- Utilisez EXPLAIN ANALYZE pour analyser les requêtes
- Ajoutez des indexes supplémentaires si nécessaire

## Prochaines étapes

1. Créer les services pour chaque entité
2. Créer les contrôleurs avec les endpoints API
3. Implémenter les guards pour les permissions
4. Ajouter les tests unitaires et d'intégration
5. Documenter les API avec Swagger
6. Implémenter les webhooks pour les notifications
7. Ajouter la recherche full-text
