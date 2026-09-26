```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenAutoMapLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

export class MbChildrenAutoMapLineItem {
    id: Guid = Guid.empty;
    productName = '';   // Automatically mapped from MbChildrenAutoMapLineItemAdded.productName
    quantity = 0;        // Automatically mapped from MbChildrenAutoMapLineItemAdded.quantity
    price = 0;            // Automatically mapped from MbChildrenAutoMapLineItemAdded.price
}

export class MbChildrenAutoMapOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenAutoMapLineItemAdded, 'itemId')
    @field(Array, { genericArguments: [MbChildrenAutoMapLineItem] }) items: MbChildrenAutoMapLineItem[] = [];
}
```
