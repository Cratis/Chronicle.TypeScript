```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('constraints-model-bound-user-registered')
class CmbUserRegistered {
    @unique('UniqueEmail') email = '';
    displayName = '';
}

@eventType('constraints-model-bound-user-email-changed')
class CmbUserEmailChanged {
    @unique('UniqueEmail') newEmail = '';
}
```
