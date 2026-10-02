```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CompositeRecordChanged {
    @field(String) orderId = '';
    @field(String) title = '';
}

class CompositeRecordKey {
    @field(String) orderId = '';
    @field(String) subject = '';
    @field(String) sourceId = '';
    @field(String) category = '';
}

class CompositeRecord {
    @field(CompositeRecordKey) id = new CompositeRecordKey();
    @field(String) title = '';
}

@projection('', CompositeRecord)
class CompositeRecordProjection implements IProjectionFor<CompositeRecord> {
    define(builder: IProjectionBuilderFor<CompositeRecord>): void {
        builder.from(CompositeRecordChanged, from => from
            .usingCompositeKey<CompositeRecordKey>(key => key
                .set(target => target.orderId, event => event.orderId)
                .set(target => target.subject).toEventContextProperty('subject')
                .set(target => target.sourceId).toEventSourceId()
                .set(target => target.category).toValue('orders')));
    }
}
```
