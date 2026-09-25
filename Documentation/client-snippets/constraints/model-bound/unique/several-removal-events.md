```typescript
import { eventType, removeConstraint } from '@cratis/chronicle';

@eventType('constraints-model-bound-invitation-accepted')
@removeConstraint('UniqueInvitedEmail')
class CmbInvitationAccepted {}

@eventType('constraints-model-bound-invitation-revoked')
@removeConstraint('UniqueInvitedEmail')
class CmbInvitationRevoked {}

@eventType('constraints-model-bound-invitation-expired')
@removeConstraint('UniqueInvitedEmail')
class CmbInvitationExpired {}
```
