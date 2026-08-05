```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class CompositeItemAddedToOrder {
    constructor(
        readonly customerId: string = '',
        readonly orderNumber: string = '',
        readonly productId: string = '',
        readonly variant: string = '',
        readonly quantity: number = 0
    ) {}
}

class CompositeItemKey {
    productId = '';
    variant = '';
}

class CompositeOrderItem {
    id = '';
    productId = '';
    variant = '';
    quantity = 0;
}

@readModel()
class CompositeOrderWithItems {
    id = '';
    orderItems: CompositeOrderItem[] = [];
}

@projection('', CompositeOrderWithItems)
class CompositeOrderItemsProjection implements IProjectionFor<CompositeOrderWithItems> {
    define(builder: IProjectionBuilderFor<CompositeOrderWithItems>): void {
        builder
            .from(CompositeOrderCreated, from => from
                .usingCompositeKey<CompositeOrderKey>(key => key
                    .set(target => target.customerId, event => event.customerId)
                    .set(target => target.orderNumber, event => event.orderNumber)))
            .children<CompositeOrderItem>(model => model.orderItems, items => items
                .identifiedBy(model => model.id)
                .from(CompositeItemAddedToOrder, from => from
                    .usingParentCompositeKey<CompositeOrderKey>(key => key
                        .set(target => target.customerId, event => event.customerId)
                        .set(target => target.orderNumber, event => event.orderNumber))
                    .usingCompositeKey<CompositeItemKey>(key => key
                        .set(target => target.productId, event => event.productId)
                        .set(target => target.variant, event => event.variant))));
    }
}
```
