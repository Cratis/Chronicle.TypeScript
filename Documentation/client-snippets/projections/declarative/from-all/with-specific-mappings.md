```typescript title="Combine FromAll with event-specific mappings"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class OrderCreatedDeclarativeAll {
    constructor(readonly orderNumber: string) {}
}

@eventType()
export class OrderShippedDeclarativeAll {
    constructor(readonly trackingNumber: string) {}
}

export class OrderDeclarativeAll {
    orderNumber = '';
    status = '';
    lastModified = new Date();
}

@projection('', OrderDeclarativeAll)
export class OrderDeclarativeAllProjection implements IProjectionFor<OrderDeclarativeAll> {
    define(builder: IProjectionBuilderFor<OrderDeclarativeAll>): void {
        builder
            .fromEvery(_ => _
                .set(m => m.lastModified)
                .toEventContextProperty('occurred')
                .excludeChildProjections())
            .from(OrderCreatedDeclarativeAll, _ => _
                .set(m => m.status)
                .toValue('Placed'))
            .from(OrderShippedDeclarativeAll, _ => _
                .set(m => m.status)
                .toValue('Shipped'));
    }
}
```
