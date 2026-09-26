```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('constraints-model-bound-named-user-registered')
@unique('UniqueUser', 'A user with this identity has already been registered.')
class CmbNamedUserRegistered {
    email = '';
    displayName = '';
}
```
