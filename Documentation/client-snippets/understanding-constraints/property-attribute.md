```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('understanding-constraints-user-registered')
class UcUserRegistered {
    @unique('UniqueEmail') email = '';
    displayName = '';
}
```
