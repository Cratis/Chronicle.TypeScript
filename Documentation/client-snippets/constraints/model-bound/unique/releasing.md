```typescript
import { eventType, removeConstraint } from '@cratis/chronicle';

@eventType('constraints-model-bound-user-removed')
@removeConstraint('UniqueEmail')
class CmbUserRemoved {
    userId = '';
}
```
