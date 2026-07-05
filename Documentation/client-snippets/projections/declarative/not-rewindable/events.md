```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecNotRewindableUserAction {
    userId = '';
    actionType = '';
    details = '';
}

@eventType()
class DecNotRewindableSystemEvent {
    componentName = '';
    eventType = '';
    data = '';
}
```
