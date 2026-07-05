```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecEventContextUserLoggedIn {
    username = '';
}

@eventType()
class DecEventContextUserPerformedAction {
    userId = '';
    actionType = '';
}
```
