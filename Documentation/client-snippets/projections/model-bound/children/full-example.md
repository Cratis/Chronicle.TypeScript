```typescript
import { childrenFrom, eventType, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

// Events
@eventType()
class MbChildrenFullOrderCreated {
    customerName = '';
}

@eventType()
class MbChildrenFullLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    initialQuantity = 0;
    unitPrice = 0;
}

@eventType()
class MbChildrenFullQuantityAdjusted {
    itemId: Guid = Guid.empty;
    newQuantity = 0;
}

@eventType()
class MbChildrenFullLineItemRemoved {
    itemId: Guid = Guid.empty;
}

// Read Models
@readModel()
class MbChildrenFullOrder {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenFullOrderCreated, 'customerName')
    customer = '';

    @childrenFrom(MbChildrenFullLineItemAdded, 'itemId')
    @removedWith(MbChildrenFullLineItemRemoved, 'itemId')
    lines: MbChildrenFullOrderLine[] = [];
}

class MbChildrenFullOrderLine {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenFullLineItemAdded, 'productName')
    product = '';

    @setFrom(MbChildrenFullLineItemAdded, 'initialQuantity')
    @setFrom(MbChildrenFullQuantityAdjusted, 'newQuantity')
    quantity = 0;

    @setFrom(MbChildrenFullLineItemAdded, 'unitPrice')
    unitPrice = 0;
}
```
