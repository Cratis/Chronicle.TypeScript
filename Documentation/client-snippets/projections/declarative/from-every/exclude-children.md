```typescript title="Exclude child projection events"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class OrderCreatedDeclarativeEveryExclude {
    constructor(readonly orderNumber: string) {}
}

export class OrderAuditDeclarativeEveryExclude {
    orderNumber = '';
    lastUpdated = new Date();
}

@projection('', OrderAuditDeclarativeEveryExclude)
export class OrderAuditDeclarativeEveryExcludeProjection implements IProjectionFor<OrderAuditDeclarativeEveryExclude> {
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
