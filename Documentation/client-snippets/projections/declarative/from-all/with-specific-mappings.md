```typescript title="Combine FromAll with event-specific mappings"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class OrderCreatedDeclarativeAll {
    constructor(readonly orderNumber: string) {}
}

@eventType()
class OrderShippedDeclarativeAll {
    constructor(readonly trackingNumber: string) {}
}

@readModel()
class OrderDeclarativeAll {
    orderNumber = '';
    status = '';
    lastModified = new Date();
}

@projection('', OrderDeclarativeAll)
class OrderDeclarativeAllProjection implements IProjectionFor<OrderDeclarativeAll> {
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
