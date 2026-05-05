# Real-Time Presence System

Ce système permet de suivre en temps réel le statut (online/offline) des membres d'une équipe dans un business.

## Fonctionnalités

- ✅ Statut en temps réel (online/offline)
- ✅ Mise à jour automatique sans rafraîchissement
- ✅ Heartbeat pour maintenir la connexion
- ✅ Authentification JWT
- ✅ Isolation par business (chaque business a sa propre room)

## Backend (NestJS)

### Architecture

- **PresenceGateway**: WebSocket gateway qui gère les connexions
- **PresenceModule**: Module qui encapsule le gateway

### Événements WebSocket

#### Côté Client → Serveur

- `heartbeat`: Envoyé toutes les 30 secondes pour maintenir la connexion
- `getOnlineUsers`: Demande la liste des utilisateurs en ligne

#### Côté Serveur → Client

- `onlineUsers`: Liste initiale des utilisateurs en ligne
- `userStatusChanged`: Notification quand un utilisateur change de statut

### Utilisation dans d'autres services

```typescript
import { PresenceGateway } from '../presence/presence.gateway';

@Injectable()
export class MyService {
  constructor(private presenceGateway: PresenceGateway) {}

  async checkUserStatus(userId: string) {
    const status = this.presenceGateway.getUserStatus(userId);
    return status; // 'online' | 'offline'
  }

  async getOnlineUsers(businessId: string) {
    const users = this.presenceGateway.getBusinessOnlineUsers(businessId);
    return users;
  }
}
```

## Frontend (React)

### Hook usePresence

```typescript
import { usePresence } from '@/hooks/usePresence';

function MyComponent() {
  const { onlineUsers, userStatuses, isConnected } = usePresence(
    businessId,
    authToken
  );

  // onlineUsers: string[] - Liste des IDs des utilisateurs en ligne
  // userStatuses: Map<string, 'online' | 'offline'> - Statut de chaque utilisateur
  // isConnected: boolean - État de la connexion WebSocket

  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {onlineUsers.map(userId => (
        <div key={userId}>User {userId} is online</div>
      ))}
    </div>
  );
}
```

### Composant PresenceIndicator

```typescript
import { PresenceIndicator } from '@/components/PresenceIndicator';

function UserCard({ userId }) {
  const { userStatuses } = usePresence(businessId, token);
  const isOnline = userStatuses.get(userId) === 'online';

  return (
    <div>
      <PresenceIndicator isOnline={isOnline} size="md" showLabel />
    </div>
  );
}
```

## Configuration

### Backend

Le WebSocket écoute sur le namespace `/presence`:
- URL: `ws://localhost:3001/presence`
- Authentification: JWT token dans `auth.token` ou `Authorization` header
- Query params: `businessId` (requis)

### Frontend

Configurez l'URL de l'API dans `.env`:
```
VITE_API_URL=http://localhost:3001
```

## Sécurité

- ✅ Authentification JWT obligatoire
- ✅ Isolation par business (un utilisateur ne peut voir que les statuts de son business)
- ✅ Déconnexion automatique si le token est invalide

## Performance

- Heartbeat toutes les 30 secondes (configurable)
- Nettoyage automatique des connexions fermées
- Utilisation de rooms Socket.IO pour l'isolation
