# Guide de Référence Rapide - Module Collaboration

## Import des entités

```typescript
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
```

## Exemples de code courants

### 1. Créer une tâche

```typescript
const task = await taskRepository.save({
  title: 'Valider le devis',
  description: 'Vérifier les prix',
  status: TaskStatus.TODO,
  priority: TaskPriority.HIGH,
  assignedToId: userId,
  createdById: currentUserId,
  tenantId: tenantId,
  businessId: businessId,
  dueDate: new Date('2024-12-31'),
});
```

### 2. Ajouter un commentaire

```typescript
const comment = await commentRepository.save({
  userId: currentUserId,
  entityType: CommentEntityType.QUOTE,
  entityId: quoteId,
  content: 'Le client demande une remise',
  mentionedUserIds: [managerId],
});
```

### 3. Créer une notification

```typescript
const notification = await notificationRepository.save({
  userId: targetUserId,
  tenantId: tenantId,
  triggeredById: currentUserId,
  type: NotificationType.TASK_ASSIGNED,
  entityType: NotificationEntityType.TASK,
  entityId: taskId,
  message: 'Nouvelle tâche assignée',
  actionUrl: `/tasks/${taskId}`,
});
```

### 4. Logger une activité

```typescript
const log = await activityLogRepository.save({
  userId: currentUserId,
  tenantId: tenantId,
  businessId: businessId,
  entityType: ActivityLogEntityType.QUOTE,
  entityId: quoteId,
  action: ActivityLogAction.UPDATE,
  description: 'Modification du montant',
  oldValue: { total: 1000 },
  newValue: { total: 900 },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

### 5. Inviter un membre d'équipe

```typescript
const invitation = await invitationRepository.save({
  tenantId: tenantId,
  businessId: businessId,
  type: InvitationType.TEAM_MEMBER,
  email: 'nouveau@example.com',
  name: 'Nouveau Membre',
  token: crypto.randomUUID(),
  invitedById: currentUserId,
  proposedRole: TeamMemberRole.MEMBER,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
});

// Envoyer l'email
await emailService.sendInvitation(invitation);
```

### 6. Créer un accès portail client

```typescript
const portalAccess = await clientPortalAccessRepository.save({
  clientId: clientId,
  businessId: businessId,
  tenantId: tenantId,
  email: client.email,
  accessLevel: ClientPortalAccessLevel.FULL,
  invitationToken: crypto.randomUUID(),
  invitationSentAt: new Date(),
});

// Envoyer l'email d'invitation
await emailService.sendClientPortalInvitation(portalAccess);
```

### 7. Créer une discussion sur document

```typescript
const discussion = await documentDiscussionRepository.save({
  tenantId: tenantId,
  businessId: businessId,
  documentType: DocumentType.QUOTE,
  documentId: quoteId,
  title: 'Question sur les conditions de paiement',
  description: 'Le client demande 60 jours au lieu de 30',
  createdById: currentUserId,
  participantIds: [managerId, accountantId],
  status: DiscussionStatus.OPEN,
});
```

## Requêtes avec relations

### Tâches avec toutes les relations

```typescript
const tasks = await taskRepository.find({
  where: { tenantId, status: TaskStatus.TODO },
  relations: [
    'assignedTo',
    'createdBy',
    'tenant',
    'business',
    'client',
    'comments',
    'comments.user',
    'activityLogs',
    'activityLogs.user',
  ],
  order: { dueDate: 'ASC' },
});
```

### Commentaires d'un document

```typescript
const comments = await commentRepository.find({
  where: {
    entityType: CommentEntityType.QUOTE,
    entityId: quoteId,
    isDeleted: false,
  },
  relations: ['user'],
  order: { createdAt: 'ASC' },
});
```

### Notifications non lues

```typescript
const unreadNotifications = await notificationRepository.find({
  where: {
    userId: currentUserId,
    isRead: false,
    isArchived: false,
  },
  relations: ['triggeredBy'],
  order: { createdAt: 'DESC' },
  take: 50,
});
```

### Membres actifs d'une équipe

```typescript
const teamMembers = await teamMemberRepository.find({
  where: {
    tenantId: tenantId,
    businessId: businessId,
    isActive: true,
  },
  relations: ['user', 'invitedBy'],
  order: { createdAt: 'ASC' },
});
```

### Journal d'activité avec filtres

```typescript
const logs = await activityLogRepository.find({
  where: {
    tenantId: tenantId,
    entityType: ActivityLogEntityType.QUOTE,
    entityId: quoteId,
  },
  relations: ['user', 'business'],
  order: { createdAt: 'DESC' },
  take: 100,
});
```

## Requêtes avancées avec QueryBuilder

### Tâches en retard

```typescript
const overdueTasks = await taskRepository
  .createQueryBuilder('task')
  .leftJoinAndSelect('task.assignedTo', 'user')
  .leftJoinAndSelect('task.business', 'business')
  .where('task.tenantId = :tenantId', { tenantId })
  .andWhere('task.status != :status', { status: TaskStatus.DONE })
  .andWhere('task.dueDate < :today', { today: new Date() })
  .orderBy('task.dueDate', 'ASC')
  .getMany();
```

### Statistiques des tâches par utilisateur

```typescript
const taskStats = await taskRepository
  .createQueryBuilder('task')
  .select('task.assignedToId', 'userId')
  .addSelect('COUNT(*)', 'totalTasks')
  .addSelect(
    "COUNT(CASE WHEN task.status = 'DONE' THEN 1 END)",
    'completedTasks'
  )
  .where('task.tenantId = :tenantId', { tenantId })
  .groupBy('task.assignedToId')
  .getRawMany();
```

### Commentaires avec mentions

```typescript
const commentsWithMentions = await commentRepository
  .createQueryBuilder('comment')
  .leftJoinAndSelect('comment.user', 'user')
  .where('comment.entityType = :entityType', { entityType })
  .andWhere('comment.entityId = :entityId', { entityId })
  .andWhere(':userId = ANY(comment.mentionedUserIds)', { userId })
  .orderBy('comment.createdAt', 'DESC')
  .getMany();
```

### Activité récente d'un utilisateur

```typescript
const recentActivity = await activityLogRepository
  .createQueryBuilder('log')
  .leftJoinAndSelect('log.user', 'user')
  .leftJoinAndSelect('log.business', 'business')
  .where('log.userId = :userId', { userId })
  .andWhere('log.createdAt > :since', {
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  })
  .orderBy('log.createdAt', 'DESC')
  .take(50)
  .getMany();
```

## Guards et Permissions

### Vérifier les permissions d'un membre

```typescript
async function checkPermission(
  userId: string,
  tenantId: string,
  permission: keyof TeamMember['permissions']
): Promise<boolean> {
  const member = await teamMemberRepository.findOne({
    where: { userId, tenantId, isActive: true },
  });

  if (!member) return false;

  // OWNER et ADMIN ont toutes les permissions
  if ([TeamMemberRole.OWNER, TeamMemberRole.ADMIN].includes(member.role)) {
    return true;
  }

  // Vérifier la permission spécifique
  return member.permissions?.[permission] === true;
}
```

### Guard NestJS pour les permissions

```typescript
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private teamMemberRepository: Repository<TeamMember>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );

    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const { userId, tenantId } = request.user;

    const member = await this.teamMemberRepository.findOne({
      where: { userId, tenantId, isActive: true },
    });

    if (!member) return false;

    if ([TeamMemberRole.OWNER, TeamMemberRole.ADMIN].includes(member.role)) {
      return true;
    }

    return requiredPermissions.every(
      (permission) => member.permissions?.[permission] === true
    );
  }
}
```

### Décorateur de permissions

```typescript
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

// Usage dans un contrôleur
@Post('clients')
@RequirePermissions('canManageClients')
async createClient(@Body() dto: CreateClientDto) {
  // ...
}
```

## Helpers utiles

### Créer une notification automatique

```typescript
async function notifyTaskAssignment(
  task: Task,
  assignedBy: User
): Promise<void> {
  await notificationRepository.save({
    userId: task.assignedToId,
    tenantId: task.tenantId,
    triggeredById: assignedBy.id,
    type: NotificationType.TASK_ASSIGNED,
    entityType: NotificationEntityType.TASK,
    entityId: task.id,
    message: `${assignedBy.name} vous a assigné la tâche "${task.title}"`,
    actionUrl: `/tasks/${task.id}`,
  });
}
```

### Logger automatiquement les modifications

```typescript
async function logEntityChange(
  userId: string,
  tenantId: string,
  entityType: ActivityLogEntityType,
  entityId: string,
  action: ActivityLogAction,
  oldValue: any,
  newValue: any,
  req: Request
): Promise<void> {
  await activityLogRepository.save({
    userId,
    tenantId,
    entityType,
    entityId,
    action,
    oldValue,
    newValue,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}
```

### Envoyer des notifications pour les mentions

```typescript
async function notifyMentions(
  comment: Comment,
  author: User
): Promise<void> {
  if (!comment.mentionedUserIds?.length) return;

  const notifications = comment.mentionedUserIds.map((userId) => ({
    userId,
    tenantId: comment.tenantId,
    triggeredById: author.id,
    type: NotificationType.MENTION,
    entityType: NotificationEntityType.COMMENT,
    entityId: comment.id,
    message: `${author.name} vous a mentionné dans un commentaire`,
    actionUrl: `/comments/${comment.id}`,
  }));

  await notificationRepository.save(notifications);
}
```

### Vérifier l'accès portail client

```typescript
async function verifyClientPortalAccess(
  email: string,
  password: string
): Promise<ClientPortalAccess | null> {
  const access = await clientPortalAccessRepository.findOne({
    where: { email, isActive: true },
    relations: ['client', 'business'],
  });

  if (!access || !access.password_hash) return null;

  const isValid = await bcrypt.compare(password, access.password_hash);
  if (!isValid) return null;

  // Mettre à jour la dernière connexion
  await clientPortalAccessRepository.update(access.id, {
    lastLoginAt: new Date(),
    lastLoginIp: req.ip,
  });

  return access;
}
```

## Événements et Webhooks

### Émettre un événement après création de tâche

```typescript
@Injectable()
export class TaskService {
  constructor(
    private taskRepository: Repository<Task>,
    private eventEmitter: EventEmitter2
  ) {}

  async createTask(dto: CreateTaskDto): Promise<Task> {
    const task = await this.taskRepository.save(dto);

    // Émettre l'événement
    this.eventEmitter.emit('task.created', {
      task,
      userId: dto.createdById,
      tenantId: dto.tenantId,
    });

    return task;
  }
}
```

### Écouter les événements

```typescript
@Injectable()
export class NotificationListener {
  constructor(
    private notificationRepository: Repository<Notification>,
    private emailService: EmailService
  ) {}

  @OnEvent('task.created')
  async handleTaskCreated(payload: any) {
    const { task, userId, tenantId } = payload;

    // Créer la notification
    const notification = await this.notificationRepository.save({
      userId: task.assignedToId,
      tenantId,
      triggeredById: userId,
      type: NotificationType.TASK_ASSIGNED,
      entityType: NotificationEntityType.TASK,
      entityId: task.id,
      message: `Nouvelle tâche: ${task.title}`,
    });

    // Envoyer l'email
    await this.emailService.sendTaskAssignmentEmail(task, notification);
  }
}
```

## Tests

### Test unitaire d'un service

```typescript
describe('TaskService', () => {
  let service: TaskService;
  let repository: Repository<Task>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    repository = module.get<Repository<Task>>(getRepositoryToken(Task));
  });

  it('should create a task', async () => {
    const dto = {
      title: 'Test Task',
      assignedToId: 'user-id',
      tenantId: 'tenant-id',
    };

    jest.spyOn(repository, 'save').mockResolvedValue(dto as Task);

    const result = await service.createTask(dto);
    expect(result).toEqual(dto);
    expect(repository.save).toHaveBeenCalledWith(dto);
  });
});
```

## Bonnes pratiques

### 1. Toujours filtrer par tenantId

```typescript
// ✅ BON
const tasks = await taskRepository.find({
  where: { tenantId, assignedToId: userId },
});

// ❌ MAUVAIS - Risque de fuite de données entre tenants
const tasks = await taskRepository.find({
  where: { assignedToId: userId },
});
```

### 2. Utiliser les transactions pour les opérations multiples

```typescript
await dataSource.transaction(async (manager) => {
  // Créer la tâche
  const task = await manager.save(Task, taskData);

  // Logger l'activité
  await manager.save(ActivityLog, {
    userId,
    tenantId,
    entityType: ActivityLogEntityType.TASK,
    entityId: task.id,
    action: ActivityLogAction.CREATE,
  });

  // Créer la notification
  await manager.save(Notification, {
    userId: task.assignedToId,
    tenantId,
    type: NotificationType.TASK_ASSIGNED,
    entityType: NotificationEntityType.TASK,
    entityId: task.id,
  });
});
```

### 3. Valider les permissions avant les actions

```typescript
async function updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
  // Vérifier que l'utilisateur a accès à cette tâche
  const task = await taskRepository.findOne({
    where: { id: taskId },
    relations: ['tenant'],
  });

  if (!task) throw new NotFoundException();

  // Vérifier les permissions
  const hasPermission = await checkPermission(
    userId,
    task.tenantId,
    'canManageTasks'
  );

  if (!hasPermission) throw new ForbiddenException();

  // Effectuer la mise à jour
  return await taskRepository.save({ ...task, ...dto });
}
```

### 4. Paginer les résultats

```typescript
async function getNotifications(userId: string, page = 1, limit = 20) {
  const [notifications, total] = await notificationRepository.findAndCount({
    where: { userId },
    relations: ['triggeredBy'],
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: notifications,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

### 5. Nettoyer les données sensibles

```typescript
function sanitizeUser(user: User) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function sanitizeClientPortalAccess(access: ClientPortalAccess) {
  const { password_hash, resetPasswordToken, ...safeAccess } = access;
  return safeAccess;
}
```
