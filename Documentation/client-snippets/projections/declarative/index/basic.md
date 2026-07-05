```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecIndexUserRegistered {
    name = '';
    email = '';
    registeredAt = new Date();
}

class DecIndexUserProfile {
    name = '';
    email = '';
    registeredAt = new Date();
}

@projection()
class DecIndexUserProfileProjection implements IProjectionFor<DecIndexUserProfile> {
    define(builder: IProjectionBuilderFor<DecIndexUserProfile>): void {
        builder.from(DecIndexUserRegistered);
    }
}
```
