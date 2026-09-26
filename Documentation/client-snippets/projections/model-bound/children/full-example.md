```typescript
import { childrenFrom, eventType, Guid, removedWith, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// Events
@eventType()
export class MbChildrenFullOrderCreated {
    customerName = '';
}

@eventType()
export class MbChildrenFullLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    initialQuantity = 0;
    unitPrice = 0;
}

@eventType()
export class MbChildrenFullQuantityAdjusted {
    itemId: Guid = Guid.empty;
    newQuantity = 0;
}

@eventType()
export class MbChildrenFullLineItemRemoved {
    itemId: Guid = Guid.empty;
}

// Read Models
export class MbChildrenFullOrderLine {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenFullLineItemAdded, 'productName')
    product = '';

    @setFrom(MbChildrenFullLineItemAdded, 'initialQuantity')
    @setFrom(MbChildrenFullQuantityAdjusted, 'newQuantity')
    quantity = 0;

    @setFrom(MbChildrenFullLineItemAdded, 'unitPrice')
    unitPrice = 0;
}

export class MbChildrenFullOrder {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenFullOrderCreated, 'customerName')
    customer = '';

    @childrenFrom(MbChildrenFullLineItemAdded, 'itemId')
    @removedWith(MbChildrenFullLineItemRemoved, 'itemId')
    @field(Array, { genericArguments: [MbChildrenFullOrderLine] }) lines: MbChildrenFullOrderLine[] = [];
}
```
