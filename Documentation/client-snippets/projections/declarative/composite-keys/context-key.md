```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CompositeUserAction {
    @field(String) userId = '';
    @field(String) action = '';
    @field(String) details = '';
}

@projection('', AuditEntryWithCompositeKey)
class AuditEntryProjectionWithCompositeKey implements IProjectionFor<AuditEntryWithCompositeKey> {
    define(builder: IProjectionBuilderFor<AuditEntryWithCompositeKey>): void {
        builder.from(CompositeUserAction, from => from
            .usingCompositeKey<AuditEntryKey>(key => key
                .set(target => target.userId).to(event => event.userId)
                .set(target => target.timestamp).toEventContextProperty('occurred')));
    }
}
```
