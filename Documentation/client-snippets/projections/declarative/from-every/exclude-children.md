```typescript title="Exclude child projection events"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class OrderCreatedDeclarativeEveryExclude {
    constructor(readonly orderNumber: string) {}
}

@readModel()
class OrderAuditDeclarativeEveryExclude {
    orderNumber = '';
    lastUpdated = new Date();
}

@projection('', OrderAuditDeclarativeEveryExclude)
class OrderAuditDeclarativeEveryExcludeProjection implements IProjectionFor<OrderAuditDeclarativeEveryExclude> {
    define(builder: IProjectionBuilderFor<OrderAuditDeclarativeEveryExclude>): void {
        builder
            .from(OrderCreatedDeclarativeEveryExclude)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred')
                .excludeChildProjections());
    }
}
```
