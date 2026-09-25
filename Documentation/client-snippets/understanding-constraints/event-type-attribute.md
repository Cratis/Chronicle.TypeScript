```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('understanding-constraints-user-registered-once')
@unique()
class UcUserRegisteredOnce {
    email = '';
    displayName = '';
}
```
