```typescript
import { eventType, removeConstraint } from '@cratis/chronicle';

@eventType('understanding-constraints-user-removed')
@removeConstraint('UniqueEmail')
class UcUserRemoved {
    userId = '';
}
```
