```typescript
import { eventType, removeConstraint } from '@cratis/chronicle';

@eventType('constraints-model-bound-once-user-removed')
@removeConstraint('UniqueUser')
class CmbOnceUserRemoved {
    userId = '';
}
```
