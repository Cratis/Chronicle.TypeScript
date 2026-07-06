```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecPassiveUserCreated {
    name = '';
    email = '';
}

@eventType()
class DecPassiveUserUpdated {
    name = '';
    email = '';
}

@eventType()
class DecPassiveUserLoggedIn {
    loginTime = new Date();
}
```
