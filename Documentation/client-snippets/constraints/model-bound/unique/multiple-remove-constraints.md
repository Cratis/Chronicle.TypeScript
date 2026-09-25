```typescript
import { eventType, removeConstraint } from '@cratis/chronicle';

@eventType('constraints-model-bound-user-multi-removed')
@removeConstraint('UniqueEmail')
@removeConstraint('UniqueUsername')
class CmbUserMultiRemoved {
    userId = '';
}
```
