```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class OrderCreatedDeclarativeEveryChildren {
    constructor(readonly orderNumber: string) {}
}

@eventType()
class ItemAddedDeclarativeEveryChildren {
    constructor(
        readonly orderId: string,
        readonly productId: string,
        readonly productName: string,
        readonly quantity: number
    ) {}
}

@eventType()
class ItemQuantityChangedDeclarativeEveryChildren {
    constructor(readonly orderId: string, readonly productId: string, readonly quantity: number) {}
}

class OrderItemDeclarativeEveryChildren {
    productId = '';
    productName = '';
    quantity = 0;
}

class OrderDeclarativeEveryChildren {
    orderNumber = '';
    lastModified = new Date();
    items: OrderItemDeclarativeEveryChildren[] = [];
}

@projection()
class OrderDeclarativeEveryChildrenProjection implements IProjectionFor<OrderDeclarativeEveryChildren> {
    define(builder: IProjectionBuilderFor<OrderDeclarativeEveryChildren>): void {
        builder
            .from(OrderCreatedDeclarativeEveryChildren)
            .fromEvery(_ => _
                .set(m => m.lastModified)
                .toEventContextProperty('occurred'))
            .children<OrderItemDeclarativeEveryChildren>(m => m.items, children => children
                .identifiedBy(m => m.productId)
                .from(ItemAddedDeclarativeEveryChildren, _ => _
                    .usingKey(e => e.productId)
                    .usingParentKey(e => e.orderId))
                .from(ItemQuantityChangedDeclarativeEveryChildren, _ => _
                    .usingKey(e => e.productId)
                    .usingParentKey(e => e.orderId)));
    }
}
```
