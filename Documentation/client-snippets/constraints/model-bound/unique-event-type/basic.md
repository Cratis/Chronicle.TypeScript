```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('constraints-model-bound-once-user-registered')
@unique()
class CmbOnceUserRegistered {
    email = '';
    displayName = '';
}
```
