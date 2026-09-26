```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class OrderCreatedDeclarativeEveryChildren {
    @field(String) readonly orderNumber: string;

    constructor(orderNumber: string) {
        this.orderNumber = orderNumber;
    }
}

@eventType()
class ItemAddedDeclarativeEveryChildren {
    @field(String) readonly orderId: string;
    @field(String) readonly productId: string;
    @field(String) readonly productName: string;
    @field(Number) readonly quantity: number;

    constructor(orderId: string, productId: string, productName: string, quantity: number) {
        this.orderId = orderId;
        this.productId = productId;
        this.productName = productName;
        this.quantity = quantity;
    }
}

@eventType()
class ItemQuantityChangedDeclarativeEveryChildren {
    @field(String) readonly orderId: string;
    @field(String) readonly productId: string;
    @field(Number) readonly quantity: number;

    constructor(orderId: string, productId: string, quantity: number) {
        this.orderId = orderId;
        this.productId = productId;
        this.quantity = quantity;
    }
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
