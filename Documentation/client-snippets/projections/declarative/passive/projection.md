```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecPassiveUserSummaryProjection implements IProjectionFor<DecPassiveUserSummary> {
    define(builder: IProjectionBuilderFor<DecPassiveUserSummary>): void {
        builder
            .passive()
            .autoMap()
            .from(DecPassiveUserCreated)
            .from(DecPassiveUserUpdated);
    }
}
```
