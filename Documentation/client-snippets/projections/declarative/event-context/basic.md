```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecEventContextUserActivityProjection implements IProjectionFor<DecEventContextUserActivity> {
    define(builder: IProjectionBuilderFor<DecEventContextUserActivity>): void {
        builder
            .from(DecEventContextUserLoggedIn, _ => _
                .set(m => m.userId).toEventSourceId()
                .set(m => m.lastLogin).toEventContextProperty('occurred'))
            .from(DecEventContextUserPerformedAction, _ => _
                .set(m => m.userId).toEventSourceId()
                .set(m => m.lastActivity).toEventContextProperty('occurred'));
    }
}
```
