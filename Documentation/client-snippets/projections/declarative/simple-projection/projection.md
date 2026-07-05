```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecSimpleUserProjection implements IProjectionFor<DecSimpleUser> {
    define(builder: IProjectionBuilderFor<DecSimpleUser>): void {
        builder.from(DecSimpleUserCreated);
    }
}
```
