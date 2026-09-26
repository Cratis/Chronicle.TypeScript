```typescript title="Exclude child projection events"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class OrderCreatedDeclarativeEveryExclude {
    @field(String) readonly orderNumber: string;

    constructor(orderNumber: string) {
        this.orderNumber = orderNumber;
    }
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
