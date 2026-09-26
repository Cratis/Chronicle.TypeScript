```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class CompositeItemAddedToOrder {
    @field(String) readonly customerId: string;
    @field(String) readonly orderNumber: string;
    @field(String) readonly productId: string;
    @field(String) readonly variant: string;
    @field(Number) readonly quantity: number;

    constructor(customerId: string = '', orderNumber: string = '', productId: string = '', variant: string = '', quantity: number = 0) {
        this.customerId = customerId;
        this.orderNumber = orderNumber;
        this.productId = productId;
        this.variant = variant;
        this.quantity = quantity;
    }
}

export class CompositeItemKey {
    productId = '';
    variant = '';
}

export class CompositeOrderItem {
    id = '';
    productId = '';
    variant = '';
    quantity = 0;
}

export class CompositeOrderWithItems {
    id = '';
    orderItems: CompositeOrderItem[] = [];
}

@projection('', CompositeOrderWithItems)
export class CompositeOrderItemsProjection implements IProjectionFor<CompositeOrderWithItems> {
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
