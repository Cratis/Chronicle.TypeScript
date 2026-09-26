```typescript title="Combine FromAll with event-specific mappings"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class OrderCreatedDeclarativeAll {
    @field(String) readonly orderNumber: string;

    constructor(orderNumber: string) {
        this.orderNumber = orderNumber;
    }
}

@eventType()
export class OrderShippedDeclarativeAll {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
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
